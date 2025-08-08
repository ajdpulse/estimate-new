import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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

// Mock database of common construction items
const mockItems = [
  {
    sr_no: "25",
    description: "Acetylene Gas for welding work",
    unit: "Kg",
    rate_2023_24: "450.00",
    rate_2024_25: "485.00",
    section: "MATERIALS",
    page_number: 15,
    keywords: ["acetylene", "gas", "welding", "cutting", "torch"]
  },
  {
    sr_no: "38",
    description: "Cement OPC 53 Grade",
    unit: "Bag",
    rate_2023_24: "385.00", 
    rate_2024_25: "420.00",
    section: "MATERIALS",
    page_number: 8,
    keywords: ["cement", "opc", "53", "grade", "binding", "concrete"]
  },
  {
    sr_no: "42",
    description: "Steel TMT Bars Fe 500",
    unit: "Kg",
    rate_2023_24: "65.00",
    rate_2024_25: "72.00",
    section: "MATERIALS",
    page_number: 12,
    keywords: ["steel", "tmt", "bars", "fe", "500", "reinforcement", "rebar"]
  },
  {
    sr_no: "15",
    description: "Sand fine aggregate",
    unit: "Cum",
    rate_2023_24: "1200.00",
    rate_2024_25: "1350.00",
    section: "MATERIALS",
    page_number: 5,
    keywords: ["sand", "fine", "aggregate", "mortar", "concrete"]
  },
  {
    sr_no: "67",
    description: "Skilled Labour Mason",
    unit: "Day",
    rate_2023_24: "650.00",
    rate_2024_25: "720.00",
    section: "LABOUR",
    page_number: 25,
    keywords: ["labour", "labor", "mason", "skilled", "worker", "craftsman"]
  },
  {
    sr_no: "89",
    description: "Brick work in cement mortar 1:6",
    unit: "Cum",
    rate_2023_24: "4500.00",
    rate_2024_25: "4950.00",
    section: "MASONRY",
    page_number: 18,
    keywords: ["brick", "work", "masonry", "cement", "mortar", "wall"]
  },
  {
    sr_no: "156",
    description: "PCC M15 grade concrete",
    unit: "Cum",
    rate_2023_24: "3200.00",
    rate_2024_25: "3520.00",
    section: "CONCRETE",
    page_number: 22,
    keywords: ["pcc", "concrete", "m15", "grade", "plain", "foundation"]
  },
  {
    sr_no: "178",
    description: "RCC M20 grade concrete",
    unit: "Cum",
    rate_2023_24: "4800.00",
    rate_2024_25: "5280.00",
    section: "CONCRETE",
    page_number: 24,
    keywords: ["rcc", "concrete", "m20", "grade", "reinforced", "structural"]
  },
  {
    sr_no: "203",
    description: "Plaster work cement mortar 1:4",
    unit: "Sqm",
    rate_2023_24: "180.00",
    rate_2024_25: "198.00",
    section: "PLASTERING",
    page_number: 28,
    keywords: ["plaster", "plastering", "cement", "mortar", "finish", "wall"]
  },
  {
    sr_no: "245",
    description: "Painting with acrylic emulsion",
    unit: "Sqm",
    rate_2023_24: "85.00",
    rate_2024_25: "93.50",
    section: "PAINTING",
    page_number: 32,
    keywords: ["painting", "paint", "acrylic", "emulsion", "wall", "finish"]
  }
];

function searchSSRItems(query: string): SearchResult[] {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const queryLower = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  for (const item of mockItems) {
    let confidence = 0.0;
    
    // Check for keyword matches
    for (const keyword of item.keywords) {
      if (keyword.includes(queryLower) || queryLower.includes(keyword)) {
        confidence += 0.15;
      }
    }
    
    // Boost confidence for exact keyword matches
    if (item.keywords.some(keyword => keyword === queryLower)) {
      confidence += 0.3;
    }
    
    // Check description similarity
    if (item.description.toLowerCase().includes(queryLower)) {
      confidence += 0.4;
    }
    
    // Boost for exact description match
    if (item.description.toLowerCase() === queryLower) {
      confidence += 0.5;
    }
    
    // Check for partial matches in description words
    const descWords = item.description.toLowerCase().split(' ');
    const queryWords = queryLower.split(' ');
    
    for (const queryWord of queryWords) {
      if (queryWord.length > 2) {
        for (const descWord of descWords) {
          if (descWord.includes(queryWord) || queryWord.includes(descWord)) {
            confidence += 0.1;
          }
        }
      }
    }
    
    // Only include items with some relevance
    if (confidence > 0.1) {
      results.push({
        primary_key: `item_${item.sr_no}`,
        sr_no: item.sr_no,
        description: item.description,
        unit: item.unit,
        rate_2023_24: item.rate_2023_24,
        rate_2024_25: item.rate_2024_25,
        section: item.section,
        page_number: item.page_number,
        confidence: Math.min(confidence, 1.0)
      });
    }
  }
  
  // Sort by confidence (highest first)
  results.sort((a, b) => b.confidence - a.confidence);
  
  // Return top 5 results
  return results.slice(0, 5);
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

    const results = searchSSRItems(query);

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