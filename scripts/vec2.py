"""
Advanced PDF Rate Q&A System - Standalone Version
Works without Supabase, with optional OpenAI integration

Required packages:
pip install pdfplumber sentence-transformers numpy pandas scikit-learn openai
"""

import os
import re
import json
import hashlib
import requests
import io
import pdfplumber
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime

# Optional OpenAI
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("ℹ️ OpenAI not installed. Using fallback query processing.")

# Embeddings
from sentence_transformers import SentenceTransformer

# Similarity metrics
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer


@dataclass
class RateItem:
    """Data class for rate items with unique primary key"""
    primary_key: str
    sr_no: Optional[str]
    description: str
    unit: Optional[str]
    rate_2023_24: Optional[str]
    rate_2024_25: Optional[str]
    section: str
    page_number: int
    table_index: int
    raw_text: str
    metadata: Dict[str, Any]
    embedding_text: str
    
    def to_dict(self) -> Dict:
        return asdict(self)


class AdvancedPDFProcessor:
    """Advanced PDF processor with intelligent chunking and extraction"""
    
    def __init__(self):
        self.items_database = {}  # primary_key -> RateItem
        self.section_mapping = {}  # section -> list of primary_keys
        self.search_index = {}  # search_term -> list of primary_keys
        
    def process_pdf(self, pdf_bytes: bytes) -> Dict[str, RateItem]:
        """Process PDF with advanced extraction techniques"""
        print("🔍 Advanced PDF Processing Started...")
        
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            current_section = "GENERAL"
            
            for page_num, page in enumerate(pdf.pages, 1):
                print(f"  📄 Processing page {page_num}/{len(pdf.pages)}...")
                
                # Extract page text for section detection
                page_text = page.extract_text() or ""
                
                # Detect section changes
                detected_section = self._detect_section(page_text)
                if detected_section:
                    current_section = detected_section
                    print(f"    📂 Section: {current_section}")
                
                # Extract tables with advanced parsing
                tables = page.extract_tables()
                for table_idx, table in enumerate(tables):
                    if self._is_valid_table(table):
                        items = self._extract_items_from_table(
                            table, current_section, page_num, table_idx
                        )
                        for item in items:
                            self.items_database[item.primary_key] = item
                            self._index_item(item)
                
                # Also extract text-based rates (non-tabular)
                text_items = self._extract_text_rates(page_text, current_section, page_num)
                for item in text_items:
                    self.items_database[item.primary_key] = item
                    self._index_item(item)
        
        print(f"✅ Extracted {len(self.items_database)} rate items")
        return self.items_database
    
    def _detect_section(self, text: str) -> Optional[str]:
        """Detect section from page text using pattern matching"""
        text_lower = text.lower()
        
        section_patterns = {
            "MATERIALS": r"section\s*[a-z]?\s*[-:]?\s*materials?|^\s*materials?\s*$",
            "LABOUR": r"section\s*[b-z]?\s*[-:]?\s*labou?r|^\s*labou?r\s*(&|and)?\s*machinery",
            "TRANSPORTATION": r"section\s*[c-z]?\s*[-:]?\s*transport",
            "CEMENT_CONSUMPTION": r"cement\s*consumption",
            "EXCAVATION": r"section\s*[e-z]?\s*[-:]?\s*excavation|earth\s*work",
            "CONCRETE": r"plain\s*&?\s*reinforced\s*cement|r\.?c\.?c|p\.?c\.?c",
            "PIPES": r"pipe\s*sections?|c\.?i\.?\s*/?d\.?i\.?\s*pipes?|p\.?v\.?c\.?\s*pipes?",
            "TREATMENT_PLANT": r"treatment\s*plant|wtp|stp",
            "RESERVOIRS": r"rcc\s*[ge]srs?|reservoirs?|sumps?",
            "CHAMBERS": r"chambers?|manholes?|drainage"
        }
        
        for section, pattern in section_patterns.items():
            if re.search(pattern, text_lower, re.MULTILINE):
                return section
        
        return None
    
    def _is_valid_table(self, table: List[List]) -> bool:
        """Check if table contains rate data"""
        if not table or len(table) < 2:
            return False
        
        # Check for rate-related headers
        header_text = " ".join([str(cell) for cell in table[0] if cell]).lower()
        rate_indicators = ["rate", "cost", "price", "rs", "description", "item", "unit"]
        
        return any(indicator in header_text for indicator in rate_indicators)
    
    def _extract_items_from_table(
        self, table: List[List], section: str, page_num: int, table_idx: int
    ) -> List[RateItem]:
        """Extract rate items from table with intelligent parsing"""
        items = []
        
        # Identify column mappings
        headers = self._parse_headers(table[0])
        
        # Process each row
        for row_idx, row in enumerate(table[1:]):
            if self._is_data_row(row):
                item = self._create_rate_item(
                    row, headers, section, page_num, table_idx, row_idx
                )
                if item:
                    items.append(item)
        
        return items
    
    def _parse_headers(self, header_row: List) -> Dict[int, str]:
        """Parse and map table headers to standard fields"""
        mapping = {}
        
        for idx, cell in enumerate(header_row):
            if not cell:
                continue
            
            cell_text = str(cell).lower().strip()
            
            # Comprehensive header mapping
            if re.search(r"sr\.?\s*no|s\.?\s*no|serial|item\s*no", cell_text):
                mapping[idx] = "sr_no"
            elif re.search(r"description|particulars?|items?|works?", cell_text):
                mapping[idx] = "description"
            elif re.search(r"units?|uom", cell_text):
                mapping[idx] = "unit"
            elif re.search(r"rate.*2024|2024.*25|rate.*24.*25", cell_text):
                mapping[idx] = "rate_2024_25"
            elif re.search(r"rate.*2023|2023.*24|rate.*23.*24", cell_text):
                mapping[idx] = "rate_2023_24"
            elif re.search(r"rates?|costs?|prices?|amounts?", cell_text):
                mapping[idx] = "rate"
        
        return mapping
    
    def _is_data_row(self, row: List) -> bool:
        """Check if row contains valid data"""
        if not row:
            return False
        
        # At least 2 non-empty cells
        non_empty = [cell for cell in row if cell and str(cell).strip()]
        return len(non_empty) >= 2
    
    def _create_rate_item(
        self, row: List, headers: Dict[int, str], 
        section: str, page_num: int, table_idx: int, row_idx: int
    ) -> Optional[RateItem]:
        """Create RateItem from table row"""
        data = {}
        
        # Extract data based on headers
        for idx, cell in enumerate(row):
            if idx in headers and cell:
                field = headers[idx]
                value = str(cell).strip()
                
                if "rate" in field:
                    value = self._clean_rate(value)
                
                data[field] = value
        
        # Must have description to be valid
        if "description" not in data:
            return None
        
        # Generate unique primary key
        key_components = [
            section,
            str(page_num),
            str(table_idx),
            str(row_idx),
            data.get("sr_no", ""),
            data["description"][:30]
        ]
        primary_key = hashlib.md5("_".join(key_components).encode()).hexdigest()
        
        # Create embedding text with all searchable content
        embedding_text = self._create_embedding_text(data, section)
        
        # Create raw text for display
        raw_text = " | ".join([f"{k}: {v}" for k, v in data.items()])
        
        return RateItem(
            primary_key=primary_key,
            sr_no=data.get("sr_no"),
            description=data["description"],
            unit=data.get("unit"),
            rate_2023_24=data.get("rate_2023_24"),
            rate_2024_25=data.get("rate_2024_25") or data.get("rate"),
            section=section,
            page_number=page_num,
            table_index=table_idx,
            raw_text=raw_text,
            metadata={
                "row_index": row_idx,
                "extracted_at": datetime.now().isoformat()
            },
            embedding_text=embedding_text
        )
    
    def _clean_rate(self, rate_str: str) -> str:
        """Clean and standardize rate values"""
        if not rate_str:
            return ""
        
        # Remove currency symbols and text
        cleaned = re.sub(r'[Rr][Ss]\.?\s*', '', rate_str)
        cleaned = re.sub(r'[₹$]', '', cleaned)
        cleaned = cleaned.replace(',', '').strip()
        
        # Extract numeric value
        match = re.search(r'[\d.]+', cleaned)
        return match.group() if match else ""
    
    def _create_embedding_text(self, data: Dict, section: str) -> str:
        """Create rich embedding text for semantic search"""
        parts = []
        
        # Add section context
        parts.append(f"Section: {section}")
        
        # Add item number if exists
        if "sr_no" in data:
            parts.append(f"Item {data['sr_no']}")
        
        # Add description with variations
        if "description" in data:
            desc = data["description"]
            parts.append(desc)
            
            # Add common variations and synonyms
            desc_lower = desc.lower()
            
            # Material-specific variations
            if "cement" in desc_lower:
                parts.extend(["OPC", "PPC", "Portland cement", "binding material"])
            if "steel" in desc_lower:
                parts.extend(["MS", "tor steel", "TMT", "reinforcement", "rebar"])
            if "aggregate" in desc_lower:
                parts.extend(["stone", "gravel", "coarse aggregate", "chips"])
            if "sand" in desc_lower:
                parts.extend(["fine aggregate", "river sand", "mortar sand"])
            if "plaster" in desc_lower:
                parts.extend(["plastering", "rendering", "finishing", "wall coating"])
            if "pipe" in desc_lower:
                parts.extend(["pipeline", "piping", "conduit"])
            if "labour" in desc_lower or "labor" in desc_lower:
                parts.extend(["worker", "manpower", "workforce"])
            if "acetylene" in desc_lower:
                parts.extend(["acetylene gas", "gas cylinder", "welding gas"])
        
        # Add unit context
        if "unit" in data:
            parts.append(f"per {data['unit']}")
            parts.append(f"Unit: {data['unit']}")
        
        # Add rate context
        if "rate_2024_25" in data:
            parts.append(f"2024-25 rate {data['rate_2024_25']}")
        if "rate_2023_24" in data:
            parts.append(f"2023-24 rate {data['rate_2023_24']}")
        
        return " | ".join(parts)
    
    def _extract_text_rates(self, text: str, section: str, page_num: int) -> List[RateItem]:
        """Extract rates from non-tabular text using patterns"""
        items = []
        
        # Pattern for rate lines (e.g., "1. Cement Bag 385")
        patterns = [
            r"(\d+)\s*[.)\]]\s*([^0-9\n]+?)\s+([A-Za-z]+)\s+(\d+)",
            r"Item\s*(\d+)[:\s]+([^0-9\n]+?)\s+([A-Za-z]+)\s+(\d+)",
        ]
        
        for pattern in patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                sr_no = match.group(1)
                description = match.group(2).strip()
                unit = match.group(3)
                rate = match.group(4)
                
                # Create primary key
                key_components = [section, str(page_num), sr_no, description[:20]]
                primary_key = hashlib.md5("_".join(key_components).encode()).hexdigest()
                
                item = RateItem(
                    primary_key=primary_key,
                    sr_no=sr_no,
                    description=description,
                    unit=unit,
                    rate_2023_24=None,
                    rate_2024_25=rate,
                    section=section,
                    page_number=page_num,
                    table_index=-1,
                    raw_text=f"{sr_no}. {description} {unit} {rate}",
                    metadata={"source": "text_extraction"},
                    embedding_text=f"Item {sr_no} {description} {unit} rate {rate}"
                )
                items.append(item)
        
        return items
    
    def _index_item(self, item: RateItem):
        """Index item for fast retrieval"""
        # Index by section
        if item.section not in self.section_mapping:
            self.section_mapping[item.section] = []
        self.section_mapping[item.section].append(item.primary_key)
        
        # Index by search terms
        search_terms = self._generate_search_terms(item)
        for term in search_terms:
            if term not in self.search_index:
                self.search_index[term] = []
            self.search_index[term].append(item.primary_key)
    
    def _generate_search_terms(self, item: RateItem) -> List[str]:
        """Generate search terms for indexing"""
        terms = []
        
        # Add item number
        if item.sr_no:
            terms.extend([
                f"item_{item.sr_no}",
                f"item {item.sr_no}",
                str(item.sr_no)
            ])
        
        # Add description words
        desc_words = item.description.lower().split()
        terms.extend([w for w in desc_words if len(w) > 2])
        
        # Add full description
        terms.append(item.description.lower())
        
        # Add section
        terms.append(item.section.lower())
        
        return terms


class QueryProcessor:
    """Process queries with or without OpenAI"""
    
    def __init__(self, use_openai: bool = False, api_key: str = None):
        self.use_openai = use_openai and OPENAI_AVAILABLE
        
        if self.use_openai:
            api_key = api_key or os.getenv("OPENAI_API_KEY")
            if api_key:
                self.client = OpenAI(api_key=api_key)
                print("✅ OpenAI initialized for query processing")
            else:
                self.use_openai = False
                print("ℹ️ No OpenAI API key found. Using fallback processing.")
    
    def process_query(self, query: str) -> Dict[str, Any]:
        """Process query to extract key information"""
        if self.use_openai:
            return self._process_with_openai(query)
        return self._process_with_regex(query)
    
    def _process_with_openai(self, query: str) -> Dict[str, Any]:
        """Process query using OpenAI"""
        try:
            prompt = f"""
            Extract key information from this construction/rate query:
            Query: "{query}"
            
            Return a JSON with:
            - material: main material/item being asked about
            - work_type: type of work (if mentioned)
            - specifications: any specs like size, thickness, etc.
            - item_number: item/sr number if mentioned
            - year: which year rate is needed (2023-24 or 2024-25)
            - intent: what user wants (rate/price/cost/information)
            
            Be precise and extract exact terms used.
            """
            
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a construction rate extraction assistant."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0,
                response_format={"type": "json_object"}
            )
            
            return json.loads(response.choices[0].message.content)
            
        except Exception as e:
            print(f"OpenAI processing failed: {e}")
            return self._process_with_regex(query)
    
    def _process_with_regex(self, query: str) -> Dict[str, Any]:
        """Process query using regex patterns"""
        query_lower = query.lower()
        
        result = {
            "material": None,
            "work_type": None,
            "specifications": {},
            "item_number": None,
            "year": "2024-25",
            "intent": "rate"
        }
        
        # Extract material
        materials = [
            "cement", "steel", "sand", "aggregate", "brick", "paint",
            "plaster", "concrete", "pipe", "acetylene", "labour", "labor",
            "carpenter", "mason", "fitter", "transport"
        ]
        
        for material in materials:
            if material in query_lower:
                result["material"] = material
                break
        
        # Extract work type
        work_types = {
            "plastering": ["plaster", "plastering", "pointing"],
            "concrete": ["concrete", "rcc", "pcc"],
            "excavation": ["excavation", "earth work"],
            "transport": ["transport", "transportation"]
        }
        
        for work, keywords in work_types.items():
            if any(kw in query_lower for kw in keywords):
                result["work_type"] = work
                break
        
        # Extract specifications
        size_match = re.search(r"(\d+)\s*mm", query_lower)
        if size_match:
            result["specifications"]["size"] = f"{size_match.group(1)}mm"
        
        thickness_match = re.search(r"(\d+)\s*mm\s*thick", query_lower)
        if thickness_match:
            result["specifications"]["thickness"] = f"{thickness_match.group(1)}mm"
        
        # Extract item number
        item_patterns = [
            r"item\s*(?:no\.?|number)?\s*(\d+)",
            r"sr\.?\s*no\.?\s*(\d+)",
            r"^(\d+)[.\s]",
            r"\s(\d+)$"
        ]
        
        for pattern in item_patterns:
            match = re.search(pattern, query_lower)
            if match:
                result["item_number"] = match.group(1)
                break
        
        # Extract year
        if "2023" in query:
            result["year"] = "2023-24"
        elif "2024" in query or "current" in query_lower or "latest" in query_lower:
            result["year"] = "2024-25"
        
        return result


class SemanticSearchEngine:
    """Semantic search engine using sentence transformers"""
    
    def __init__(self, items_database: Dict[str, RateItem]):
        self.items_database = items_database
        print("🔄 Initializing semantic search engine...")
        
        # Use a good model that's not too large
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.embeddings_cache = {}
        self.tfidf_vectorizer = TfidfVectorizer(max_features=1000)
        
        # Pre-compute embeddings
        self._compute_embeddings()
    
    def _compute_embeddings(self):
        """Pre-compute embeddings for all items"""
        print("  Computing embeddings...")
        
        texts = []
        keys = []
        
        for key, item in self.items_database.items():
            texts.append(item.embedding_text)
            keys.append(key)
        
        if texts:
            # Compute embeddings in batch
            embeddings = self.model.encode(texts, show_progress_bar=True)
            
            for key, embedding in zip(keys, embeddings):
                self.embeddings_cache[key] = embedding
            
            # Fit TF-IDF vectorizer
            self.tfidf_vectorizer.fit(texts)
            
            print(f"  ✅ Computed {len(self.embeddings_cache)} embeddings")
    
    def search(self, query: str, query_info: Dict, top_k: int = 5) -> List[Tuple[RateItem, float]]:
        """Perform semantic search with scoring"""
        
        # Get query embedding
        query_embedding = self.model.encode(query)
        
        # Calculate scores for all items
        scored_items = []
        
        for key, item in self.items_database.items():
            # Calculate different types of scores
            scores = {
                "semantic": self._calculate_semantic_score(query_embedding, self.embeddings_cache[key]),
                "keyword": self._calculate_keyword_score(item, query_info),
                "item_number": self._calculate_item_number_score(item, query_info),
                "section": self._calculate_section_score(item, query_info)
            }
            
            # Weighted combination
            total_score = (
                scores["semantic"] * 0.4 +
                scores["keyword"] * 0.3 +
                scores["item_number"] * 0.2 +
                scores["section"] * 0.1
            )
            
            scored_items.append((item, total_score, scores))
        
        # Sort by total score
        scored_items.sort(key=lambda x: x[1], reverse=True)
        
        # Return top k results
        return [(item, score) for item, score, _ in scored_items[:top_k]]
    
    def _calculate_semantic_score(self, query_emb: np.ndarray, item_emb: np.ndarray) -> float:
        """Calculate cosine similarity"""
        return float(cosine_similarity([query_emb], [item_emb])[0][0])
    
    def _calculate_keyword_score(self, item: RateItem, query_info: Dict) -> float:
        """Calculate keyword matching score"""
        score = 0.0
        
        item_text_lower = (item.description + " " + item.embedding_text).lower()
        
        # Material match
        if query_info.get("material"):
            if query_info["material"].lower() in item_text_lower:
                score += 0.5
        
        # Work type match
        if query_info.get("work_type"):
            if query_info["work_type"].lower() in item_text_lower:
                score += 0.3
        
        # Specifications match
        if query_info.get("specifications"):
            for spec_value in query_info["specifications"].values():
                if str(spec_value) in item.raw_text:
                    score += 0.2
        
        return min(score, 1.0)
    
    def _calculate_item_number_score(self, item: RateItem, query_info: Dict) -> float:
        """Calculate item number match score"""
        if query_info.get("item_number") and item.sr_no:
            if str(query_info["item_number"]) == str(item.sr_no):
                return 1.0
        return 0.0
    
    def _calculate_section_score(self, item: RateItem, query_info: Dict) -> float:
        """Calculate section relevance score"""
        if not query_info.get("material"):
            return 0.0
        
        material = query_info["material"].lower()
        
        # Material to section mapping
        section_mapping = {
            "MATERIALS": ["cement", "steel", "sand", "aggregate", "brick", "paint", "acetylene"],
            "LABOUR": ["labour", "labor", "carpenter", "mason", "fitter", "worker"],
            "TRANSPORTATION": ["transport", "carting", "handling"],
            "PIPES": ["pipe", "pipeline", "pvc", "hdpe", "gi", "di"]
        }
        
        for section, keywords in section_mapping.items():
            if item.section == section and material in keywords:
                return 1.0
        
        return 0.0


class AdvancedRateQASystem:
    """Main Q&A system"""
    
    def __init__(self, pdf_url: str, use_openai: bool = False):
        self.pdf_url = pdf_url
        self.processor = AdvancedPDFProcessor()
        self.query_processor = QueryProcessor(use_openai=use_openai)
        self.search_engine = None
        self.items_database = {}
    
    def initialize(self):
        """Initialize the system"""
        print("\n" + "="*60)
        print("🚀 ADVANCED PDF RATE Q&A SYSTEM")
        print("="*60)
        
        # Download PDF
        print("\n📥 Downloading PDF...")
        response = requests.get(self.pdf_url)
        response.raise_for_status()
        pdf_bytes = response.content
        print(f"✅ Downloaded {len(pdf_bytes):,} bytes")
        
        # Process PDF
        print("\n📊 Processing PDF with advanced extraction...")
        self.items_database = self.processor.process_pdf(pdf_bytes)
        
        # Initialize search engine
        print("\n🔍 Initializing semantic search engine...")
        self.search_engine = SemanticSearchEngine(self.items_database)
        
        self._display_summary()
    
    def _display_summary(self):
        """Display extraction summary"""
        print("\n" + "="*60)
        print("📈 EXTRACTION SUMMARY")
        print("="*60)
        
        # Count by section
        section_counts = {}
        for item in self.items_database.values():
            section_counts[item.section] = section_counts.get(item.section, 0) + 1
        
        print(f"Total Items: {len(self.items_database)}")
        print("\nBy Section:")
        for section, count in sorted(section_counts.items()):
            print(f"  • {section}: {count} items")
        
        # Show sample items
        print("\nSample Items:")
        for i, item in enumerate(list(self.items_database.values())[:3]):
            print(f"  {i+1}. {item.description[:50]}...")
            if item.sr_no:
                print(f"     Item No: {item.sr_no}")
            if item.rate_2024_25:
                print(f"     Rate: Rs. {item.rate_2024_25}")
        
        print("="*60)
    
    def answer_query(self, query: str) -> str:
        """Answer a rate query"""
        
        # Process query
        print(f"\n🤔 Understanding query: '{query}'")
        query_info = self.query_processor.process_query(query)
        
        # Perform semantic search
        results = self.search_engine.search(query, query_info, top_k=3)
        
        if not results:
            return self._format_no_results()
        
        # Format answer based on confidence
        best_item, score = results[0]
        
        if score > 0.5:  # High confidence
            return self._format_exact_answer(best_item, query_info, score)
        else:  # Low confidence
            return self._format_suggestions(results)
    
    def _format_exact_answer(self, item: RateItem, query_info: Dict, score: float) -> str:
        """Format exact answer"""
        lines = []
        
        lines.append("\n" + "="*60)
        lines.append("✅ EXACT RATE FOUND")
        lines.append("="*60)
        
        if item.sr_no:
            lines.append(f"📍 Item No: {item.sr_no}")
        
        lines.append(f"📋 Description: {item.description}")
        
        if item.unit:
            lines.append(f"📐 Unit: {item.unit}")
        
        lines.append(f"📂 Section: {item.section}")
        lines.append(f"📄 Page: {item.page_number}")
        
        # Display rate
        year = query_info.get("year", "2024-25")
        
        lines.append("")
        if year == "2024-25" and item.rate_2024_25:
            lines.append(f"💰 **RATE (2024-25): Rs. {item.rate_2024_25}**")
        elif year == "2023-24" and item.rate_2023_24:
            lines.append(f"💰 **RATE (2023-24): Rs. {item.rate_2023_24}**")
        else:
            if item.rate_2024_25:
                lines.append(f"💰 Rate (2024-25): Rs. {item.rate_2024_25}")
            if item.rate_2023_24:
                lines.append(f"💰 Rate (2023-24): Rs. {item.rate_2023_24}")
        
        lines.append(f"\n🎯 Confidence: {score:.1%}")
        lines.append("="*60)
        
        return "\n".join(lines)
    
    def _format_suggestions(self, results: List[Tuple[RateItem, float]]) -> str:
        """Format suggestions"""
        lines = []
        
        lines.append("\n" + "="*60)
        lines.append("📊 POSSIBLE MATCHES")
        lines.append("="*60)
        
        for idx, (item, score) in enumerate(results[:3], 1):
            lines.append(f"\n{idx}. {item.description}")
            if item.sr_no:
                lines.append(f"   Item No: {item.sr_no}")
            if item.unit:
                lines.append(f"   Unit: {item.unit}")
            
            if item.rate_2024_25:
                lines.append(f"   Rate (2024-25): Rs. {item.rate_2024_25}")
            elif item.rate_2023_24:
                lines.append(f"   Rate (2023-24): Rs. {item.rate_2023_24}")
            
            lines.append(f"   Match: {score:.1%}")
        
        lines.append("\n💡 Try being more specific or use exact item numbers")
        lines.append("="*60)
        
        return "\n".join(lines)
    
    def _format_no_results(self) -> str:
        """Format no results message"""
        return """
❌ No matching rates found.

💡 Tips:
• Use exact item numbers (e.g., "item 25")
• Use specific material names
• Include section if known
• Check spelling
"""
    
    def run_interactive(self):
        """Run interactive Q&A session"""
        self.initialize()
        
        print("\n" + "="*60)
        print("🎯 SYSTEM READY")
        print("="*60)
        print("\n📝 Example queries:")
        print("  • What is the rate of Acetylene Gas?")
        print("  • Item 38 rate")
        print("  • Cement rate 2024-25")
        print("  • Labour rate for carpenter")
        print("\nType 'quit' to exit.\n")
        
        while True:
            try:
                query = input("\n❓ Your question: ").strip()
                
                if query.lower() in ['quit', 'exit', 'q']:
                    print("\n👋 Goodbye!")
                    break
                
                if query:
                    answer = self.answer_query(query)
                    print(answer)
                    
            except KeyboardInterrupt:
                print("\n\n👋 Goodbye!")
                break
            except Exception as e:
                print(f"\n❌ Error: {e}")


# ==== MAIN EXECUTION ====
if __name__ == "__main__":
    # Your PDF URL
    PDF_URL = "https://tvmqkondihsomlebizjj.supabase.co/storage/v1/object/sign/estimate-forms/MJP%20SSR%202023-24_Final.pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV85OGM0N2MwMC1hZDQ5LTQ1NDYtOWViNS05NjVhMWJlZGNjNWQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3RpbWF0ZS1mb3Jtcy9NSlAgU1NSIDIwMjMtMjRfRmluYWwucGRmIiwiaWF0IjoxNzU0NTU3MTg1LCJleHAiOjE3NTUxNjE5ODV9.fs6AV85ideRnsi_ZMBHfdDJ1Ajtdbr4H40hM54dOiWc"
    
    # Set to True if you have OpenAI API key
    USE_OPENAI = True
    
    # Optional: Set OpenAI API key

    os.environ["OPENAI_API_KEY"] = "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"

    
    # Create and run the system
    qa_system = AdvancedRateQASystem(pdf_url=PDF_URL, use_openai=USE_OPENAI)
    qa_system.run_interactive()