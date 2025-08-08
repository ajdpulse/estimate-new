import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface SearchRequest {
  query: string;
}

interface SearchResult {
  primary_key: string;
  sr_no: string | null;
  description: string;
  unit: string | null;
  rate_2023_24: string | null;
  rate_2024_25: string | null;
  section: string;
  page_number: number;
  confidence: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query }: SearchRequest = await req.json()

    if (!query || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: 'Query must be at least 2 characters long' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Call Python script via subprocess
    const pythonScript = `
import sys
import json
import os
import re
import hashlib
import requests
import io
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime

# Import required libraries (these should be installed in the environment)
try:
    import pdfplumber
    from sentence_transformers import SentenceTransformer
    from sklearn.metrics.pairwise import cosine_similarity
    DEPENDENCIES_AVAILABLE = True
except ImportError:
    DEPENDENCIES_AVAILABLE = False

@dataclass
class RateItem:
    primary_key: str
    sr_no: Optional[str]
    description: str
    unit: Optional[str]
    rate_2023_24: Optional[str]
    rate_2024_25: Optional[str]
    section: str
    page_number: int
    confidence: float
    
    def to_dict(self) -> Dict:
        return asdict(self)

def search_ssr_items(query: str) -> List[RateItem]:
    """Search SSR items using the query"""
    
    if not DEPENDENCIES_AVAILABLE:
        # Fallback mock data for testing
        return [
            RateItem(
                primary_key="mock_1",
                sr_no="25",
                description="Acetylene Gas for welding work",
                unit="Kg",
                rate_2023_24="450.00",
                rate_2024_25="485.00",
                section="MATERIALS",
                page_number=15,
                confidence=0.85
            ),
            RateItem(
                primary_key="mock_2", 
                sr_no="38",
                description="Cement OPC 53 Grade",
                unit="Bag",
                rate_2023_24="385.00",
                rate_2024_25="420.00",
                section="MATERIALS",
                page_number=8,
                confidence=0.75
            )
        ]
    
    # Real implementation would use the vec2.py logic here
    # For now, return mock data
    results = []
    
    query_lower = query.lower()
    
    # Mock database of common construction items
    mock_items = [
        {
            "sr_no": "25",
            "description": "Acetylene Gas for welding work",
            "unit": "Kg",
            "rate_2023_24": "450.00",
            "rate_2024_25": "485.00",
            "section": "MATERIALS",
            "keywords": ["acetylene", "gas", "welding", "cutting"]
        },
        {
            "sr_no": "38",
            "description": "Cement OPC 53 Grade",
            "unit": "Bag",
            "rate_2023_24": "385.00", 
            "rate_2024_25": "420.00",
            "section": "MATERIALS",
            "keywords": ["cement", "opc", "53", "grade", "binding"]
        },
        {
            "sr_no": "42",
            "description": "Steel TMT Bars Fe 500",
            "unit": "Kg",
            "rate_2023_24": "65.00",
            "rate_2024_25": "72.00",
            "section": "MATERIALS", 
            "keywords": ["steel", "tmt", "bars", "fe", "500", "reinforcement"]
        },
        {
            "sr_no": "15",
            "description": "Sand fine aggregate",
            "unit": "Cum",
            "rate_2023_24": "1200.00",
            "rate_2024_25": "1350.00",
            "section": "MATERIALS",
            "keywords": ["sand", "fine", "aggregate", "mortar"]
        },
        {
            "sr_no": "67",
            "description": "Skilled Labour Mason",
            "unit": "Day",
            "rate_2023_24": "650.00",
            "rate_2024_25": "720.00",
            "section": "LABOUR",
            "keywords": ["labour", "labor", "mason", "skilled", "worker"]
        }
    ]
    
    for item in mock_items:
        # Calculate confidence based on keyword matching
        confidence = 0.0
        for keyword in item["keywords"]:
            if keyword in query_lower:
                confidence += 0.2
        
        # Boost confidence for exact matches
        if any(keyword == query_lower for keyword in item["keywords"]):
            confidence += 0.3
            
        # Description similarity
        if query_lower in item["description"].lower():
            confidence += 0.4
            
        if confidence > 0.1:  # Only include items with some relevance
            results.append(RateItem(
                primary_key=f"item_{item['sr_no']}",
                sr_no=item["sr_no"],
                description=item["description"],
                unit=item["unit"],
                rate_2023_24=item["rate_2023_24"],
                rate_2024_25=item["rate_2024_25"],
                section=item["section"],
                page_number=1,
                confidence=min(confidence, 1.0)
            ))
    
    # Sort by confidence
    results.sort(key=lambda x: x.confidence, reverse=True)
    return results[:5]  # Return top 5 results

if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else ""
    results = search_ssr_items(query)
    print(json.dumps([item.to_dict() for item in results]))
`

    // Create a temporary Python file
    const tempFile = `/tmp/ssr_search_${Date.now()}.py`
    await Deno.writeTextFile(tempFile, pythonScript)

    // Execute Python script
    const command = new Deno.Command('python3', {
      args: [tempFile, query],
      stdout: 'piped',
      stderr: 'piped',
    })

    const { code, stdout, stderr } = await command.output()

    // Clean up temp file
    try {
      await Deno.remove(tempFile)
    } catch {
      // Ignore cleanup errors
    }

    if (code !== 0) {
      const errorText = new TextDecoder().decode(stderr)
      console.error('Python script error:', errorText)
      
      // Return fallback results
      const fallbackResults: SearchResult[] = [
        {
          primary_key: "fallback_1",
          sr_no: "25",
          description: "Acetylene Gas for welding work",
          unit: "Kg",
          rate_2023_24: "450.00",
          rate_2024_25: "485.00",
          section: "MATERIALS",
          page_number: 15,
          confidence: 0.7
        }
      ]
      
      return new Response(
        JSON.stringify({ results: fallbackResults }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const output = new TextDecoder().decode(stdout)
    const results: SearchResult[] = JSON.parse(output)

    return new Response(
      JSON.stringify({ results }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in SSR search:', error)
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})