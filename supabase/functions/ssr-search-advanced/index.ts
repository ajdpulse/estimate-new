import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface SearchRequest {
  query: string;
  max_results?: number;
}

interface RateItem {
  primary_key: string;
  sr_no: string | null;
  description: string;
  unit: string | null;
  rate_2023_24: string | null;
  rate_2024_25: string | null;
  section: string;
  page_number: number;
  table_index: number;
  raw_text: string;
  metadata: Record<string, any>;
  embedding_text: string;
  search_keywords: string[];
  display_text: string;
}

interface SearchSuggestion {
  item: RateItem;
  relevance_score: number;
  match_type: string;
  matched_keywords: string[];
}

// Enhanced mock database with more construction items based on vec2.py
const mockItems = [
  {
    sr_no: "25",
    description: "Acetylene Gas for welding work",
    unit: "Kg",
    rate_2023_24: "450.00",
    rate_2024_25: "485.00",
    section: "MATERIALS",
    page_number: 15,
    keywords: ["acetylene", "gas", "welding", "cutting", "torch", "oxygen", "flame"]
  },
  {
    sr_no: "38",
    description: "Cement OPC 53 Grade",
    unit: "Bag",
    rate_2023_24: "385.00", 
    rate_2024_25: "420.00",
    section: "MATERIALS",
    page_number: 8,
    keywords: ["cement", "opc", "53", "grade", "binding", "concrete", "mortar", "bag"]
  },
  {
    sr_no: "42",
    description: "Steel TMT Bars Fe 500",
    unit: "Kg",
    rate_2023_24: "65.00",
    rate_2024_25: "72.00",
    section: "MATERIALS",
    page_number: 12,
    keywords: ["steel", "tmt", "bars", "fe", "500", "reinforcement", "rebar", "iron"]
  },
  {
    sr_no: "15",
    description: "Sand fine aggregate",
    unit: "Cum",
    rate_2023_24: "1200.00",
    rate_2024_25: "1350.00",
    section: "MATERIALS",
    page_number: 5,
    keywords: ["sand", "fine", "aggregate", "mortar", "concrete", "river", "construction"]
  },
  {
    sr_no: "67",
    description: "Skilled Labour Mason",
    unit: "Day",
    rate_2023_24: "650.00",
    rate_2024_25: "720.00",
    section: "LABOUR",
    page_number: 25,
    keywords: ["labour", "labor", "mason", "skilled", "worker", "craftsman", "daily"]
  },
  {
    sr_no: "89",
    description: "Brick work in cement mortar 1:6",
    unit: "Cum",
    rate_2023_24: "4500.00",
    rate_2024_25: "4950.00",
    section: "MASONRY",
    page_number: 18,
    keywords: ["brick", "work", "masonry", "cement", "mortar", "wall", "construction"]
  },
  {
    sr_no: "156",
    description: "PCC M15 grade concrete",
    unit: "Cum",
    rate_2023_24: "3200.00",
    rate_2024_25: "3520.00",
    section: "CONCRETE",
    page_number: 22,
    keywords: ["pcc", "concrete", "m15", "grade", "plain", "foundation", "cement"]
  },
  {
    sr_no: "178",
    description: "RCC M20 grade concrete",
    unit: "Cum",
    rate_2023_24: "4800.00",
    rate_2024_25: "5280.00",
    section: "CONCRETE",
    page_number: 24,
    keywords: ["rcc", "concrete", "m20", "grade", "reinforced", "structural", "steel"]
  },
  {
    sr_no: "203",
    description: "Plaster work cement mortar 1:4",
    unit: "Sqm",
    rate_2023_24: "180.00",
    rate_2024_25: "198.00",
    section: "PLASTERING",
    page_number: 28,
    keywords: ["plaster", "plastering", "cement", "mortar", "finish", "wall", "surface"]
  },
  {
    sr_no: "245",
    description: "Painting with acrylic emulsion",
    unit: "Sqm",
    rate_2023_24: "85.00",
    rate_2024_25: "93.50",
    section: "PAINTING",
    page_number: 32,
    keywords: ["painting", "paint", "acrylic", "emulsion", "wall", "finish", "coating"]
  },
  {
    sr_no: "301",
    description: "Excavation in ordinary soil",
    unit: "Cum",
    rate_2023_24: "120.00",
    rate_2024_25: "132.00",
    section: "EXCAVATION",
    page_number: 35,
    keywords: ["excavation", "digging", "earth", "soil", "foundation", "trenching"]
  },
  {
    sr_no: "412",
    description: "PVC Pipe 110mm dia",
    unit: "Rmt",
    rate_2023_24: "285.00",
    rate_2024_25: "313.50",
    section: "PIPES",
    page_number: 40,
    keywords: ["pvc", "pipe", "110mm", "diameter", "plumbing", "drainage", "water"]
  },
  {
    sr_no: "523",
    description: "Carpenter skilled labour",
    unit: "Day",
    rate_2023_24: "680.00",
    rate_2024_25: "748.00",
    section: "LABOUR",
    page_number: 26,
    keywords: ["carpenter", "skilled", "labour", "wood", "timber", "furniture", "daily"]
  },
  {
    sr_no: "634",
    description: "Aggregate 20mm size",
    unit: "Cum",
    rate_2023_24: "1800.00",
    rate_2024_25: "1980.00",
    section: "MATERIALS",
    page_number: 6,
    keywords: ["aggregate", "20mm", "coarse", "stone", "concrete", "gravel", "chips"]
  },
  {
    sr_no: "745",
    description: "Electrical wiring copper wire",
    unit: "Rmt",
    rate_2023_24: "45.00",
    rate_2024_25: "49.50",
    section: "ELECTRICAL",
    page_number: 45,
    keywords: ["electrical", "wiring", "copper", "wire", "cable", "conductor", "power"]
  }
];

function createRateItem(mockItem: any): RateItem {
  const embedding_text = `${mockItem.section} ${mockItem.description} ${mockItem.unit} ${mockItem.keywords.join(' ')}`;
  const display_text = `#${mockItem.sr_no} ${mockItem.description} (${mockItem.unit}) - Rs. ${mockItem.rate_2024_25}`;
  
  return {
    primary_key: `item_${mockItem.sr_no}`,
    sr_no: mockItem.sr_no,
    description: mockItem.description,
    unit: mockItem.unit,
    rate_2023_24: mockItem.rate_2023_24,
    rate_2024_25: mockItem.rate_2024_25,
    section: mockItem.section,
    page_number: mockItem.page_number,
    table_index: 0,
    raw_text: `${mockItem.sr_no} | ${mockItem.description} | ${mockItem.unit} | ${mockItem.rate_2024_25}`,
    metadata: {
      extracted_at: new Date().toISOString(),
      source: "ssr_database"
    },
    embedding_text,
    search_keywords: mockItem.keywords,
    display_text
  };
}

function searchSSRItems(query: string, maxResults: number = 3): SearchSuggestion[] {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const queryLower = query.toLowerCase().trim();
  const queryWords = queryLower.split(/\s+/);
  const results: SearchSuggestion[] = [];

  for (const mockItem of mockItems) {
    const item = createRateItem(mockItem);
    let confidence = 0.0;
    const matchedKeywords: string[] = [];
    
    // A) Exact item number match
    if (item.sr_no && (queryLower === item.sr_no || queryLower === `item ${item.sr_no}`)) {
      confidence += 1.0;
      matchedKeywords.push(`item ${item.sr_no}`);
    }
    
    // B) Keyword matching (union of all matched keywords)
    for (const keyword of item.search_keywords) {
      for (const queryWord of queryWords) {
        if (keyword.includes(queryWord) || queryWord.includes(keyword)) {
          confidence += 0.15;
          if (!matchedKeywords.includes(keyword)) {
            matchedKeywords.push(keyword);
          }
        }
      }
    }
    
    // C) Exact keyword matches (boost)
    for (const keyword of item.search_keywords) {
      if (queryWords.includes(keyword)) {
        confidence += 0.3;
      }
    }
    
    // D) Description similarity
    const descLower = item.description.toLowerCase();
    if (descLower.includes(queryLower)) {
      confidence += 0.4;
    }
    
    // E) Exact description match (boost)
    if (descLower === queryLower) {
      confidence += 0.5;
    }
    
    // F) Partial matches in description words
    const descWords = descLower.split(/\s+/);
    for (const queryWord of queryWords) {
      if (queryWord.length > 2) {
        for (const descWord of descWords) {
          if (descWord.includes(queryWord) || queryWord.includes(descWord)) {
            confidence += 0.1;
          }
        }
      }
    }
    
    // G) Section matching
    if (item.section.toLowerCase().includes(queryLower)) {
      confidence += 0.2;
    }
    
    // H) Unit matching
    if (item.unit && item.unit.toLowerCase().includes(queryLower)) {
      confidence += 0.1;
    }
    
    // Determine match type
    let matchType = "semantic";
    if (item.sr_no && queryLower.includes(item.sr_no)) {
      matchType = "exact_item";
    } else if (descLower.includes(queryLower)) {
      matchType = "exact";
    } else if (matchedKeywords.length > 0) {
      matchType = "keyword";
    } else if (confidence > 0.3) {
      matchType = "partial";
    }
    
    // Only include items with some relevance
    if (confidence > 0.1) {
      results.push({
        item,
        relevance_score: Math.min(confidence, 1.0),
        match_type: matchType,
        matched_keywords: matchedKeywords.slice(0, 5) // Limit matched keywords
      });
    }
  }
  
  // Sort by confidence (highest first) and return top results
  results.sort((a, b) => b.relevance_score - a.relevance_score);
  return results.slice(0, maxResults);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query, max_results = 3 }: SearchRequest = await req.json()

    if (!query || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ 
          status: 'error',
          message: 'Query must be at least 2 characters long',
          results: []
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const suggestions = searchSSRItems(query, max_results);

    return new Response(
      JSON.stringify({ 
        status: 'success',
        query,
        total_found: suggestions.length,
        results: suggestions.map(s => ({
          id: s.item.primary_key,
          item_no: s.item.sr_no,
          description: s.item.description,
          unit: s.item.unit,
          rate_2024_25: s.item.rate_2024_25,
          rate_2023_24: s.item.rate_2023_24,
          section: s.item.section,
          page: s.item.page_number,
          display_text: s.item.display_text,
          keywords: s.item.search_keywords,
          relevance_score: Math.round(s.relevance_score * 100) / 100,
          match_type: s.match_type,
          matched_keywords: s.matched_keywords
        }))
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in SSR search:', error)
    
    return new Response(
      JSON.stringify({ 
        status: 'error',
        message: 'Internal server error',
        results: []
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})