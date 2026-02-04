"use client";

import { motion } from "framer-motion";
import {
  Home,
  Activity,
  ShieldCheck,
  Search,
  ChevronDown,
  ArrowLeft,
  CheckCircle2,
  ChevronUp,
  Plus,
  Mic,
  Send,
  Check,
  Users,
  AlertCircle,
  Loader2
} from "lucide-react";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { procurementApi } from "@/lib/api/procurement";
import type { ProofPoint, AcceptedRecommendationsData } from "@/context/AppContext";
import {
  calculateOpportunityRiskImpact,
  calculateOpportunityESGImpact,
  type ProofPointResult
} from "@/lib/calculations/procurement-metrics";

// ============================================================================
// DYNAMIC DATA CONFIGURATIONS
// ============================================================================

// Dynamic questions mapped to PROOF POINTS by their actual IDs from AppContext
// Each proof point has its own validation question
const PROOF_POINT_QUESTIONS: Record<string, {
  question: string;
  options: string[];
}> = {
  // ============ Volume Bundling (vb-pp-*) ============
  "vb-pp-1": { // Regional Spend
    question: "How is your spend distributed across regions/sites?",
    options: [
      "Don't track regional distribution",
      "Rough estimates only",
      "Tracked but not actively managed",
      "Actively managed with consolidation targets"
    ]
  },
  "vb-pp-2": { // Tail Spend
    question: "How do you manage tail spend (low-value, fragmented purchases)?",
    options: [
      "No visibility into tail spend",
      "Know it exists but don't manage it",
      "Periodic cleanup efforts",
      "Active tail spend management program"
    ]
  },
  "vb-pp-3": { // Volume Leverage
    question: "Do you leverage total volume when negotiating with suppliers?",
    options: [
      "Each site negotiates independently",
      "Some informal volume aggregation",
      "Centralized negotiation for key categories",
      "Full volume leverage across all sites"
    ]
  },
  "vb-pp-4": { // Price Variance
    question: "Do you see price differences for similar items across suppliers/sites?",
    options: [
      "Don't track price variance",
      "Yes, significant variance exists",
      "Some variance, working to reduce",
      "Minimal variance, prices standardized"
    ]
  },
  "vb-pp-5": { // Avg Spend/Supplier
    question: "How concentrated is your spend among suppliers?",
    options: [
      "Very fragmented - many small suppliers",
      "Somewhat fragmented",
      "Moderately concentrated",
      "Strategic suppliers handle most spend"
    ]
  },
  "vb-pp-6": { // Market Consolidation
    question: "How consolidated is your supplier market?",
    options: [
      "Don't know market structure",
      "Many small players",
      "Mix of large and small suppliers",
      "Few dominant suppliers"
    ]
  },
  "vb-pp-7": { // Supplier Location
    question: "Where are your suppliers primarily located?",
    options: [
      "Don't track supplier locations",
      "Mostly local/regional",
      "Mix of local and international",
      "Strategic global sourcing"
    ]
  },
  "vb-pp-8": { // Supplier Risk Rating
    question: "Do you assess financial health/risk of your suppliers?",
    options: [
      "No supplier risk assessment",
      "Basic checks for new suppliers only",
      "Annual risk reviews for key suppliers",
      "Continuous risk monitoring with ratings"
    ]
  },

  // ============ Target Pricing (tp-pp-*) ============
  "tp-pp-1": { // Price Variance
    question: "Do you see price differences for similar items across suppliers?",
    options: [
      "Don't track price variance",
      "Yes, significant variance exists",
      "Some variance, working to reduce",
      "Minimal variance, prices standardized"
    ]
  },
  "tp-pp-2": { // Tariff Rate
    question: "Do tariffs/duties significantly impact your costs?",
    options: [
      "Don't track tariff impact",
      "Aware but not managed",
      "Factor into sourcing decisions",
      "Optimized sourcing for duty savings"
    ]
  },
  "tp-pp-3": { // Cost Structure
    question: "Do you understand the cost breakdown of what you buy?",
    options: [
      "No cost visibility",
      "High-level estimates only",
      "Detailed cost models for some items",
      "Should-cost models for key categories"
    ]
  },
  "tp-pp-4": { // Unit Price
    question: "Do you track unit prices and compare across suppliers?",
    options: [
      "No unit price tracking",
      "Track but don't compare",
      "Regular price comparisons",
      "Automated price benchmarking"
    ]
  },

  // ============ Risk Management (rm-pp-*) ============
  "rm-pp-1": { // Single Sourcing
    question: "Do you have single-source dependencies?",
    options: [
      "Don't know",
      "Yes, for many categories",
      "Some, but working on alternatives",
      "Minimal - dual source for critical items"
    ]
  },
  "rm-pp-2": { // Supplier Concentration
    question: "How concentrated is your spend with top suppliers?",
    options: [
      "Don't track concentration",
      "Very concentrated (>70% with top 3)",
      "Moderately concentrated (40-70%)",
      "Well diversified (<40%)"
    ]
  },
  "rm-pp-3": { // Category Risk
    question: "Do you assess risk at category level?",
    options: [
      "No category risk assessment",
      "Ad-hoc when issues arise",
      "Annual category risk reviews",
      "Ongoing category risk management"
    ]
  },
  "rm-pp-4": { // Inflation
    question: "How do you manage inflation impact on your categories?",
    options: [
      "No inflation tracking",
      "React when prices increase",
      "Monitor inflation indices",
      "Proactive hedging/contracts"
    ]
  },
  "rm-pp-5": { // Exchange Rate
    question: "How do you manage currency/exchange rate risk?",
    options: [
      "No FX management",
      "Accept FX fluctuations",
      "Some currency hedging",
      "Active FX risk management"
    ]
  },
  "rm-pp-6": { // Geo Political
    question: "Do you consider geopolitical factors in sourcing?",
    options: [
      "Not considered",
      "React when issues occur",
      "Factor into major decisions",
      "Proactive risk monitoring"
    ]
  },
  "rm-pp-7": { // Supplier Risk Rating
    question: "Do you assess financial health/risk of your suppliers?",
    options: [
      "No supplier risk assessment",
      "Basic checks for new suppliers only",
      "Annual risk reviews for key suppliers",
      "Continuous risk monitoring with ratings"
    ]
  },

  // ============ Re-spec Pack (rp-pp-*) ============
  "rp-pp-1": { // Price Variance
    question: "Do you see price differences that suggest spec optimization opportunities?",
    options: [
      "Don't analyze for spec opportunities",
      "Some variance noticed",
      "Regularly review for opportunities",
      "Systematic spec optimization program"
    ]
  },
  "rp-pp-2": { // Export Data
    question: "Have you explored alternative sourcing regions or suppliers?",
    options: [
      "No exploration done",
      "Occasionally when needed",
      "Regular alternative sourcing reviews",
      "Active global sourcing program"
    ]
  },
  "rp-pp-3": { // Cost Structure
    question: "Do you analyze cost structure to identify spec-driven savings?",
    options: [
      "No cost breakdown analysis",
      "High-level estimates only",
      "Detailed analysis for some items",
      "Value engineering for key items"
    ]
  }
};

// Fallback generic questions if proof point not mapped
const GENERIC_QUESTIONS: Record<string, {
  question: string;
  options: string[];
}[]> = {
  "volume-bundling": [
    {
      question: "How mature is your demand consolidation process?",
      options: ["No process", "Basic", "Developing", "Advanced"]
    }
  ],
  "target-pricing": [
    {
      question: "How mature is your pricing management?",
      options: ["No process", "Basic", "Developing", "Advanced"]
    }
  ],
  "risk-management": [
    {
      question: "How mature is your risk management?",
      options: ["No process", "Basic", "Developing", "Advanced"]
    }
  ],
  "respec-pack": [
    {
      question: "How mature is your spec management?",
      options: ["No process", "Basic", "Developing", "Advanced"]
    }
  ]
};

// Tests/Analysis steps for each opportunity type
const OPPORTUNITY_TESTS: Record<string, string[]> = {
  "volume-bundling": [
    "Analyzed spend data to identify high-spend suppliers and consolidation opportunities",
    "Calculated regional spend distribution and identified bundling potential",
    "Evaluated supplier concentration (HHI Index) across categories",
    "Identified tail spend percentage and fragmentation patterns",
    "Assessed volume leverage potential based on supplier count"
  ],
  "target-pricing": [
    "Analyzed price variance across suppliers for similar items",
    "Compared current prices against market benchmarks and indices",
    "Evaluated cost structure breakdown (materials, labor, logistics)",
    "Assessed tariff and duty impacts on landed costs",
    "Reviewed contract terms for pricing adjustment mechanisms"
  ],
  "risk-management": [
    "Identified single-source dependencies and concentration risks",
    "Analyzed supplier geographic distribution and geopolitical exposure",
    "Evaluated supplier financial health and risk ratings",
    "Assessed category-specific risk factors (supply disruption, quality)",
    "Reviewed contract coverage and contingency provisions"
  ],
  "respec-pack": [
    "Analyzed specification variations across regions and sites",
    "Identified SKU proliferation and low-volume items",
    "Evaluated cost impact of specification complexity",
    "Assessed standardization opportunities without functionality loss",
    "Reviewed export data for alternative sourcing options"
  ]
};

// Recommendations for each opportunity type (dynamic based on data)
const getRecommendations = (
  oppType: string,
  categoryName: string,
  topSuppliers: string[]
): { text: string; checked: boolean }[] => {
  const supplier1 = topSuppliers[0] || "your top supplier";
  const supplier2 = topSuppliers[1] || "your second supplier";

  switch (oppType) {
    case "volume-bundling":
      return [
        { text: `Consolidate demands across sites for ${categoryName} to leverage economies of scale`, checked: true },
        { text: `Negotiate volume-based discounts with ${supplier1} and ${supplier2}`, checked: true },
        { text: `Bundle similar sub-categories to increase negotiating leverage`, checked: true },
        { text: `Set up quarterly demand aggregation reviews`, checked: false }
      ];
    case "target-pricing":
      return [
        { text: `Implement should-cost analysis for ${categoryName} key items`, checked: true },
        { text: `Switch to index-based pricing with ${supplier1}`, checked: true },
        { text: `Re-negotiate pricing terms with ${supplier2} based on market benchmarks`, checked: true },
        { text: `Set up automated price monitoring with ±5% threshold alerts`, checked: false }
      ];
    case "risk-management":
      return [
        { text: `Qualify backup suppliers for ${categoryName} to reduce concentration risk`, checked: true },
        { text: `Standardize payment terms to Net 60 across all suppliers`, checked: true },
        { text: `Develop contingency sourcing plan for high-risk regions`, checked: true },
        { text: `Implement supplier risk monitoring dashboard`, checked: false }
      ];
    case "respec-pack":
      return [
        { text: `Rationalize SKUs to reduce low value/volume items in ${categoryName}`, checked: true },
        { text: `Standardize specifications across regions for top 20 items`, checked: true },
        { text: `Evaluate alternative materials/specs with ${supplier1}`, checked: true },
        { text: `Set up cross-functional spec review committee`, checked: false }
      ];
    default:
      return [
        { text: `Review and optimize ${categoryName} procurement strategy`, checked: true },
        { text: `Engage with key suppliers for improvement opportunities`, checked: true }
      ];
  }
};

// Initiative titles for each opportunity type
const INITIATIVE_TITLES: Record<string, string[]> = {
  "volume-bundling": [
    "Consolidate demands across sites to leverage economies of scale",
    "Consider volume consolidation for better discounts",
    "Bundle similar categories to increase negotiating leverage"
  ],
  "target-pricing": [
    "Use cost model driven pricing mechanisms",
    "Implement should-cost analysis for key items",
    "Adjust sourcing mix to minimize tariff impact"
  ],
  "risk-management": [
    "Explore adding new suppliers to reduce supplier risk",
    "Standardize payment terms across suppliers to 60 days",
    "Develop contingency sourcing plans for high-risk regions"
  ],
  "respec-pack": [
    "Rationalize SKUs to reduce low value/volume items",
    "Standardize specifications across regions"
  ]
};

// Chat message type
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function OpportunityDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, actions } = useApp();

  // Get opportunity info from URL params
  const oppId = searchParams.get("opp") || "volume-bundling";
  const initIndex = parseInt(searchParams.get("init") || "0");

  // State - Chat focused with integrated MCQ
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // MCQ state - integrated into chat flow
  const [answeredQuestions, setAnsweredQuestions] = useState<{index: number; answer: number}[]>([]);
  const [showMCQ, setShowMCQ] = useState(true); // Show MCQ in chat

  // Track which proof point is being validated via chat
  const [validatingProofPointId, setValidatingProofPointId] = useState<string | null>(null);
  const [pendingValidation, setPendingValidation] = useState(false);

  // LLM Recommendations state
  const [llmRecommendations, setLlmRecommendations] = useState<string[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [selectedRecommendations, setSelectedRecommendations] = useState<Set<number>>(new Set());


  // Get data from context
  const categoryName = state.setupData.categoryName || "Edible Oils";
  const setupOpportunities = state.setupOpportunities;
  const computedMetrics = state.computedMetrics;
  const totalSpend = state.setupData.spend || 0;
  const goals = state.setupData.goals || { cost: 60, risk: 25, esg: 15 };

  // Get locations from portfolio items (selected categories)
  const portfolioItems = state.portfolioItems || [];
  const selectedCategories = state.selectedCategories || [];
  const categoryLocations = useMemo(() => {
    // Method 1: Try matching by selected category names
    const categoryNames = selectedCategories.length > 0
      ? selectedCategories.map(n => n.trim().toLowerCase())
      : categoryName.split(',').map(n => n.trim().toLowerCase());

    const matchingItems = portfolioItems.filter(item =>
      categoryNames.some(name =>
        item.name.toLowerCase() === name ||
        item.name.toLowerCase().includes(name) ||
        name.includes(item.name.toLowerCase())
      )
    );

    // Combine all locations from matching portfolio items
    const allLocations = matchingItems.flatMap(item => item.locations || []);

    // Remove duplicates and return
    const uniqueLocations = [...new Set(allLocations)];

    // Debug log to see what's happening
    console.log('[Locations Debug]', {
      categoryName,
      selectedCategories,
      portfolioItems: portfolioItems.map(p => ({ name: p.name, locations: p.locations })),
      matchingItems: matchingItems.map(m => m.name),
      foundLocations: uniqueLocations
    });

    return uniqueLocations;
  }, [categoryName, selectedCategories, portfolioItems]);

  // Find the opportunity data
  const opportunity = setupOpportunities.find(o => o.id === oppId);
  const proofPoints = opportunity?.proofPoints || [];

  // Get unvalidated proof points
  const unvalidatedProofPoints = proofPoints.filter(pp => !pp.isValidated);
  const validatedCount = proofPoints.filter(pp => pp.isValidated).length;
  const confidence = proofPoints.length > 0 ? Math.round((validatedCount / proofPoints.length) * 100) : 0;

  // Get initiative title
  const initiativeTitles = INITIATIVE_TITLES[oppId] || [];
  const initiativeTitle = initiativeTitles[initIndex] || opportunity?.name || "Opportunity";

  // Get question for the CURRENT unvalidated proof point
  const currentProofPointToValidate = unvalidatedProofPoints[0];
  const currentQuestion = currentProofPointToValidate
    ? PROOF_POINT_QUESTIONS[currentProofPointToValidate.id] || GENERIC_QUESTIONS[oppId]?.[0]
    : null;
  const questionsAnswered = answeredQuestions.length;

  // Get tests for this opportunity type
  const tests = OPPORTUNITY_TESTS[oppId] || [];

  // Extract top suppliers from context (spendAnalysis or parsed CSV data)
  const topSuppliers = useMemo(() => {
    // Priority 1: Use pre-computed spendAnalysis if available
    if (state.spendAnalysis?.topSuppliers && state.spendAnalysis.topSuppliers.length > 0) {
      return state.spendAnalysis.topSuppliers.slice(0, 5).map(s => ({
        name: s.name,
        spend: s.spend
      }));
    }

    // Priority 2: Try to parse from persisted spend file data
    const spendFile = state.persistedReviewData?.spendFile;
    if (spendFile?.parsedData?.rows && Array.isArray(spendFile.parsedData.rows)) {
      const supplierSpend: Record<string, number> = {};
      spendFile.parsedData.rows.forEach((row: Record<string, string>) => {
        // Try various column name variations
        const supplier = row.supplier_name || row.Supplier || row.supplier || row.SUPPLIER ||
                        row.vendor_name || row.Vendor || row.vendor || row.VENDOR ||
                        row['Supplier Name'] || row['SUPPLIER NAME'];
        const spendStr = row.spend || row.Spend || row.SPEND || row.amount || row.Amount ||
                        row.value || row.Value || row['Spend Amount'] || row['Total Spend'];
        const spend = parseFloat(String(spendStr || 0));
        if (supplier && !isNaN(spend) && spend > 0) {
          supplierSpend[supplier] = (supplierSpend[supplier] || 0) + spend;
        }
      });

      const sorted = Object.entries(supplierSpend)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, spend]) => ({ name, spend }));

      if (sorted.length > 0) {
        return sorted;
      }
    }

    // Fallback to defaults if no data available
    return [
      { name: "Top Supplier 1", spend: 0 },
      { name: "Top Supplier 2", spend: 0 },
      { name: "Top Supplier 3", spend: 0 }
    ];
  }, [state.spendAnalysis, state.persistedReviewData]);

  // Fetch LLM recommendations on page load
  useEffect(() => {
    const fetchRecommendations = async () => {
      setIsLoadingRecommendations(true);
      setRecommendationsError(null);

      try {
        console.log('[Recommendations] Fetching...');
        const response = await procurementApi.getOpportunityRecommendations({
          opportunityType: oppId,
          categoryName,
          locations: categoryLocations.length > 0 ? categoryLocations : undefined,
          spendData: {
            totalSpend,
            breakdown: topSuppliers.map(s => ({ supplier: s.name, spend: s.spend }))
          },
          supplierData: topSuppliers,
          metrics: {
            priceVariance: computedMetrics?.priceVariance || 15,
            top3Concentration: computedMetrics?.top3Concentration || 65,
            tailSpendPercentage: computedMetrics?.tailSpendPercentage || 12,
            supplierCount: computedMetrics?.supplierCount || topSuppliers.length,
            avgSpendPerSupplier: totalSpend / (topSuppliers.length || 1)
          },
          proofPoints: proofPoints.map(pp => ({
            id: pp.id,
            name: pp.name,
            isValidated: pp.isValidated,
            description: pp.description
          }))
        });

        console.log('[Recommendations] Response:', response);
        console.log('[Recommendations] Type of recommendations:', typeof response.recommendations);
        console.log('[Recommendations] First item:', response.recommendations?.[0]);

        if (response.recommendations && response.recommendations.length > 0) {
          // Handle case where recommendations might be JSON strings or nested objects
          let recs = response.recommendations;

          // If the first item looks like JSON, try to parse it
          if (recs.length === 1 && typeof recs[0] === 'string') {
            const firstItem = recs[0].trim();
            if (firstItem.startsWith('{') || firstItem.startsWith('[')) {
              try {
                const parsed = JSON.parse(firstItem);
                if (Array.isArray(parsed)) {
                  recs = parsed;
                } else if (parsed.recommendations || parsed.Recommendations) {
                  recs = parsed.recommendations || parsed.Recommendations;
                }
              } catch {
                // Keep original if parsing fails
              }
            }
          }

          // Ensure all items are strings (not objects)
          recs = recs.map((r: unknown) => {
            if (typeof r === 'string') return r;
            if (typeof r === 'object' && r !== null) {
              // If it's an object with a text/recommendation property, extract it
              const obj = r as Record<string, unknown>;
              return obj.text || obj.recommendation || obj.content || JSON.stringify(r);
            }
            return String(r);
          });

          console.log('[Recommendations] Final recs:', recs);
          setLlmRecommendations(recs);
        } else {
          // Use fallback recommendations
          setLlmRecommendations(getRecommendations(oppId, categoryName, topSuppliers.map(s => s.name)).map(r => r.text));
        }
      } catch (error) {
        console.error("Failed to fetch recommendations:", error);
        setRecommendationsError("Failed to fetch recommendations");
        // Use fallback recommendations on error
        setLlmRecommendations(getRecommendations(oppId, categoryName, topSuppliers.map(s => s.name)).map(r => r.text));
      } finally {
        setIsLoadingRecommendations(false);
      }
    };

    fetchRecommendations();
  }, [oppId, categoryName, categoryLocations, totalSpend, topSuppliers, proofPoints, computedMetrics]);

  // Fallback static recommendations (used only if LLM fails)
  const fallbackRecommendations = getRecommendations(oppId, categoryName, topSuppliers.map(s => s.name));

  // Convert proof points to ProofPointResult format for calculation
  // ProofPoint from context only has: id, name, description, isValidated
  // ProofPointResult needs: id, name, value, impact, insight, isTested, threshold
  const proofPointResults: ProofPointResult[] = useMemo(() => {
    return proofPoints.map(pp => ({
      id: pp.id,
      name: pp.name,
      value: 0, // Default value since ProofPoint doesn't have this
      impact: 'Not Tested' as const, // Default - will be evaluated based on data
      insight: pp.description || '', // Use description as fallback
      isTested: pp.isValidated,
      threshold: {
        high: '',
        medium: '',
        low: ''
      }
    }));
  }, [proofPoints]);

  // Calculate dynamic Risk and ESG impacts
  const riskImpact = useMemo(() => {
    return calculateOpportunityRiskImpact(oppId, proofPointResults, computedMetrics || undefined);
  }, [oppId, proofPointResults, computedMetrics]);

  const esgImpact = useMemo(() => {
    return calculateOpportunityESGImpact(oppId, proofPointResults, computedMetrics || undefined);
  }, [oppId, proofPointResults, computedMetrics]);

  // Calculate metrics
  const impact = confidence >= 70 ? "High" : confidence >= 40 ? "Medium" : "Low";
  const effort = oppId === "respec-pack" ? "6-12 Months" : "3-6 Months";
  const risk = riskImpact.label;
  const esg = esgImpact.label;

  // Format currency
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  };

  // Calculate potential savings
  const savingsPercentage = oppId === "volume-bundling" ? "3-5%" :
    oppId === "target-pricing" ? "2-4%" :
    oppId === "risk-management" ? "1-2%" : "1-3%";

  // Validate a proof point and update the opportunity
  const validateProofPoint = useCallback((proofPointId: string) => {
    if (!opportunity) return;

    const updatedProofPoints = opportunity.proofPoints.map(pp =>
      pp.id === proofPointId ? { ...pp, isValidated: true } : pp
    );

    const updatedOpportunity = {
      ...opportunity,
      proofPoints: updatedProofPoints
    };

    actions.updateSetupOpportunity(updatedOpportunity);
    setValidatingProofPointId(null);
    setPendingValidation(false);

    // Add activity for validation
    actions.addActivity({
      type: "validation",
      title: `Validated: ${proofPoints.find(pp => pp.id === proofPointId)?.name || "Proof Point"}`,
      description: `Proof point validated for ${opportunity.name} in ${categoryName}`,
      metadata: { categoryName }
    });
  }, [opportunity, actions, proofPoints, categoryName]);

  // Handle MCQ answer - validates the specific proof point being asked about
  const handleMCQAnswer = useCallback((proofPointId: string, answerIndex: number, answerText: string) => {
    if (!proofPointId) return;

    const proofPoint = proofPoints.find(pp => pp.id === proofPointId);
    if (!proofPoint) return;

    // Add user's answer as a chat message
    const userAnswerMessage: ChatMessage = {
      id: `mcq-answer-${Date.now()}`,
      role: "user",
      content: answerText,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, userAnswerMessage]);

    // Record the answer
    setAnsweredQuestions(prev => [...prev, { index: answeredQuestions.length, answer: answerIndex }]);

    // Higher answer = more mature = validates the proof point
    const maturityLevel = answerIndex; // 0=low, 1=medium-low, 2=medium-high, 3=high

    setIsLoading(true);
    setTimeout(() => {
      let responseContent = "";

      if (maturityLevel >= 2) {
        // Good answer - validate this proof point
        responseContent = `Got it! Based on your response, I've validated "${proofPoint.name}" ✅`;
        validateProofPoint(proofPointId);

        // Check if more proof points to validate
        const remainingUnvalidated = proofPoints.filter(pp => !pp.isValidated && pp.id !== proofPointId);
        if (remainingUnvalidated.length > 0) {
          responseContent += `\n\nLet's validate "${remainingUnvalidated[0].name}" next...`;
          setShowMCQ(true);
        } else {
          responseContent += `\n\n🎉 All proof points validated! Confidence is now at 100%. Feel free to ask me anything else about this opportunity.`;
          setShowMCQ(false);
        }
      } else {
        // Lower maturity - still mark as validated but note the gap
        responseContent = `Thanks for your honesty. I've noted "${proofPoint.name}" as validated, but there's room for improvement here. This actually strengthens the case for this initiative!`;
        validateProofPoint(proofPointId);

        const remainingUnvalidated = proofPoints.filter(pp => !pp.isValidated && pp.id !== proofPointId);
        if (remainingUnvalidated.length > 0) {
          responseContent += `\n\nLet's continue with "${remainingUnvalidated[0].name}"...`;
          setShowMCQ(true);
        } else {
          responseContent += `\n\nAll proof points reviewed! Feel free to ask me anything.`;
          setShowMCQ(false);
        }
      }

      const aiResponse: ChatMessage = {
        id: `mcq-response-${Date.now()}`,
        role: "assistant",
        content: responseContent,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    }, 800);
  }, [proofPoints, answeredQuestions.length, validateProofPoint]);

  // Handle chat submission with proof point validation detection
  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: chatInput.trim(),
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    const userInput = chatInput.trim().toLowerCase();
    setChatInput("");
    setIsLoading(true);

    // Check if user is providing information to validate a proof point
    // Look for keywords that indicate user is answering validation questions
    // Covers all proof points across all 4 opportunity types
    const validationKeywords = [
      // General affirmative responses
      "yes", "we have", "we do", "confirmed", "correct", "right",
      // Volume Bundling keywords
      "region", "regional", "spend", "distribution", "tail spend", "fragmented",
      "volume", "consolidated", "leverage", "price variance", "difference",
      "supplier", "suppliers", "average", "market", "consolidation", "location",
      "risk rating", "financial health", "risk score",
      // Target Pricing keywords
      "tariff", "import", "export", "duty", "cost structure", "breakdown",
      "unit price", "per unit", "cost model", "should cost",
      // Risk Management keywords
      "single source", "sole source", "one supplier", "concentration",
      "category risk", "disruption", "inflation", "price increase",
      "exchange rate", "currency", "foreign", "geopolitical", "political",
      // Re-spec Pack keywords
      "specification", "spec", "alternative", "sourcing", "different region",
      // Numbers and data indicators
      "percent", "%", "million", "thousand", "$", "annually", "monthly"
    ];
    const isProvidingValidationInfo = validationKeywords.some(kw => userInput.includes(kw));

    // If there's a pending validation and user seems to be answering
    if (pendingValidation && validatingProofPointId && isProvidingValidationInfo) {
      // Validate the proof point after AI responds
      setTimeout(() => {
        validateProofPoint(validatingProofPointId);
      }, 2000); // Wait for AI response then validate
    }

    try {
      const response = await procurementApi.getOpportunityInsights(
        oppId,
        categoryName,
        totalSpend,
        proofPoints,
        userMessage.content
      );

      const assistantContent = response.assistant_message.content;
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: assistantContent,
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, assistantMessage]);

      // Check if Max is asking about a specific unvalidated proof point
      // and set up pending validation for the next user response
      if (unvalidatedProofPoints.length > 0) {
        const ppToValidate = unvalidatedProofPoints.find(pp => {
          const ppNameLower = pp.name.toLowerCase();
          return assistantContent.toLowerCase().includes(ppNameLower) ||
                 userInput.includes(ppNameLower);
        });

        if (ppToValidate && !validatingProofPointId) {
          setValidatingProofPointId(ppToValidate.id);
          setPendingValidation(true);
        }
      }

      // If user provided validation info and we validated, add a confirmation message
      if (pendingValidation && validatingProofPointId && isProvidingValidationInfo) {
        const validatedPP = proofPoints.find(pp => pp.id === validatingProofPointId);
        setTimeout(() => {
          const confirmMessage: ChatMessage = {
            id: `confirm-${Date.now()}`,
            role: "assistant",
            content: `✅ Great! Based on your response, I've validated the "${validatedPP?.name}" proof point. Your confidence level has increased!`,
            timestamp: new Date()
          };
          setChatMessages(prev => [...prev, confirmMessage]);
        }, 2500);
      }

    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I couldn't process your request. Please make sure the backend server is running.",
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick action to manually validate a proof point
  const handleManualValidate = (proofPointId: string) => {
    validateProofPoint(proofPointId);
  };

  // NOTE: Disabled initial AI fetch - it returns long summaries unsuitable for chat
  // The welcome message uses getInsightText() which is short and conversational
  // AI responses are only fetched when user actually sends a chat message

  // Generate SHORT insight text for chat - keep it conversational
  const getInsightText = () => {
    switch (oppId) {
      case "volume-bundling":
        return `I found consolidation opportunities in ${categoryName}. Let me ask a few questions to validate the savings potential.`;
      case "target-pricing":
        return `I spotted price variations in ${categoryName} that could mean savings. A few quick questions will help me quantify this.`;
      case "risk-management":
        return `Your ${categoryName} supply base has some concentration risk. Let's validate this together.`;
      case "respec-pack":
        return `I found spec variations in ${categoryName} worth exploring. Quick questions coming up!`;
      default:
        return `I found opportunities in ${categoryName}. Let me ask you a few questions.`;
    }
  };

  // Generate detailed insight for the right panel card
  const getDetailedInsightText = () => {
    const priceVariance = computedMetrics?.priceVariance || 15;
    const top3Concentration = computedMetrics?.top3Concentration || 65;
    const tailSpend = computedMetrics?.tailSpendPercentage || 12;

    switch (oppId) {
      case "volume-bundling":
        return `Your top 3 suppliers account for ${top3Concentration.toFixed(0)}% of spend, with ${tailSpend.toFixed(0)}% in tail spend. Consolidating demand across sites could unlock ${savingsPercentage} savings.`;
      case "target-pricing":
        return `Price variation of ${priceVariance.toFixed(0)}% detected across similar SKUs. Index-based pricing mechanisms could standardize costs and reduce spend by ${savingsPercentage}.`;
      case "risk-management":
        return `Supplier concentration at ${top3Concentration.toFixed(0)}% creates supply risk. Diversifying your supplier base can reduce disruption risk while maintaining competitive pricing.`;
      case "respec-pack":
        return `Specification variations across regions identified. Harmonizing specs could simplify procurement, reduce complexity, and improve leverage with suppliers.`;
      default:
        return `Analysis of your ${categoryName} spend data reveals optimization opportunities worth ${savingsPercentage} of addressable spend.`;
    }
  };

  // Get chart title based on opportunity type
  const getChartTitle = () => {
    switch (oppId) {
      case "volume-bundling":
        return "Spend Concentration by Supplier";
      case "target-pricing":
        return `${categoryName} Price Index Trend`;
      case "risk-management":
        return "Supplier Risk Distribution";
      case "respec-pack":
        return "SKU Complexity Analysis";
      default:
        return "Analysis Overview";
    }
  };

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-gradient-to-b from-[#E8F4FC] via-[#F0F8FF] to-white">
      {/* Left Icon Sidebar */}
      <div className="relative z-20 flex w-16 flex-col items-center border-r border-white/20 bg-white/40 py-6 backdrop-blur-xl shrink-0">
        {/* Logo */}
        <Link href="/dashboard" className="mb-8 flex h-11 w-11 items-center justify-center rounded-2xl overflow-hidden shadow-lg">
          <div className="h-full w-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
            <div className="h-5 w-5 rounded-full bg-white/30 backdrop-blur-sm" />
          </div>
        </Link>

        {/* Main Navigation */}
        <div className="flex flex-col gap-5 text-gray-400">
          <Link href="/dashboard" className="p-2.5 rounded-xl hover:bg-white/50 transition-colors cursor-pointer">
            <Home className="h-5 w-5" strokeWidth={1.5} />
          </Link>
          <Link href="/today" className="p-2.5 rounded-xl hover:bg-white/50 transition-colors cursor-pointer">
            <Activity className="h-5 w-5" strokeWidth={1.5} />
          </Link>
          <Link href="/opportunities" className="p-2.5 rounded-xl bg-white shadow-sm text-blue-600 ring-1 ring-black/5 transition-colors cursor-pointer">
            <ShieldCheck className="h-5 w-5" strokeWidth={1.5} />
          </Link>
        </div>

        {/* Bottom Navigation */}
        <div className="mt-auto flex flex-col gap-5 text-gray-400">
          <div className="p-2.5 rounded-xl hover:bg-white/50 transition-colors cursor-pointer">
            <Search className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="p-2.5 rounded-xl hover:bg-white/50 transition-colors cursor-pointer">
            <Users className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-white text-sm font-semibold cursor-pointer hover:bg-gray-800 transition-colors">
            N
          </Link>
        </div>
      </div>

      {/* Main Container */}
      <div className="relative z-30 flex flex-1 overflow-hidden bg-gradient-to-b from-[#E8F4FC] via-[#F0F8FF] to-white">

        {/* Left Column: Opportunity Assistant */}
        <div className="flex w-[440px] flex-col border-r border-gray-100 bg-white shrink-0">
          {/* Header */}
          <header className="flex h-14 items-center gap-3 border-b border-gray-100 px-5">
            <Link href="/opportunities" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft className="h-4 w-4 text-gray-600" />
            </Link>
            <div className="flex items-center gap-2 overflow-hidden flex-1">
              <h1 className="truncate text-[14px] font-semibold text-gray-900">{initiativeTitle}</h1>
              <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
            </div>
          </header>

          {/* Content - Chat Only */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Max AI Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-purple-500">
                  <span className="text-white font-bold text-sm">M</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-[15px] font-semibold text-gray-900">Max AI</h3>
                  <p className="text-[11px] text-gray-500">Procurement Intelligence Assistant</p>
                </div>
                <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  confidence >= 80 ? 'bg-emerald-100 text-emerald-700' :
                  confidence >= 50 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {confidence}% Confidence
                </div>
              </div>

              {/* Success message when all validated */}
              {unvalidatedProofPoints.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200"
                >
                  <p className="text-[13px] text-emerald-700 font-medium">
                    🎉 All proof points validated! Confidence is at 100%.
                  </p>
                  <p className="text-[11px] text-emerald-600 mt-1">
                    Feel free to ask me anything else about this opportunity.
                  </p>
                </motion.div>
              )}

              {/* Welcome message - shown when no chat yet */}
              {chatMessages.length === 0 && unvalidatedProofPoints.length > 0 && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100">
                  <p className="text-[13px] text-gray-700 leading-relaxed">
                    {getInsightText()}
                  </p>
                </div>
              )}

              {/* MCQ Question Card - Prominent when there's a question */}
              {currentQuestion && showMCQ && currentProofPointToValidate && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 rounded-2xl bg-white border-2 border-blue-200 shadow-lg shadow-blue-100/50"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                      <AlertCircle className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <span className="text-[12px] font-semibold text-blue-600">
                      Validating: {currentProofPointToValidate.name}
                    </span>
                  </div>
                  <p className="text-[14px] font-medium text-gray-800 mb-4 leading-relaxed">
                    {currentQuestion.question}
                  </p>
                  <div className="space-y-2">
                    {currentQuestion.options.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleMCQAnswer(currentProofPointToValidate.id, idx, option)}
                        disabled={isLoading}
                        className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-[12px] text-gray-700 disabled:opacity-50 group"
                      >
                        <span className="inline-flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 group-hover:bg-blue-200 group-hover:text-blue-700 transition-colors">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          {option}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Chat Messages */}
              {chatMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-2xl text-[13px] ${
                    msg.role === "user"
                      ? "bg-gray-100 text-gray-900 ml-8"
                      : "bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 text-gray-700 mr-4"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {msg.role === "assistant" && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-purple-500">
                        <span className="text-white font-bold text-[8px]">M</span>
                      </div>
                    )}
                    <span className="text-[10px] font-semibold uppercase text-gray-400">
                      {msg.role === "user" ? "You" : "Max AI"}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </motion.div>
              ))}

              {/* Loading state */}
              {isLoading && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 mr-4">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-purple-500">
                    <Loader2 className="h-3 w-3 animate-spin text-white" />
                  </div>
                  <span className="text-[13px] text-gray-500">Max is thinking...</span>
                </div>
              )}

              {/* Hint when MCQ is hidden but there are unvalidated points */}
              {!showMCQ && unvalidatedProofPoints.length > 0 && chatMessages.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-[11px] text-amber-700">
                    💡 Ask me about "{unvalidatedProofPoints[0].name}" to validate it, or click any unvalidated proof point above.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Input Area */}
          <div className="p-5 border-t border-gray-100">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleChatSubmit();
              }}
              className="relative flex items-center gap-3 rounded-2xl bg-[#F5F7F9] p-3 ring-1 ring-gray-200/50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 p-[1px] shrink-0">
                <div className="h-full w-full rounded-full bg-white flex items-center justify-center">
                  <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400" />
                </div>
              </div>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about this opportunity..."
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400 disabled:opacity-50"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isLoading}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                    chatInput.trim() && !isLoading
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8 pb-32">
            <div className="max-w-3xl mx-auto space-y-5">

              {/* Collapse Toggle */}
              <div className="flex justify-end">
                <ChevronUp className="h-5 w-5 text-gray-400 cursor-pointer hover:text-gray-600" />
              </div>

              {/* Main Card */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-gray-100"
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 tracking-wider block mb-2">
                      {categoryName.toUpperCase()}
                    </span>
                    <h2 className="text-xl font-bold text-gray-900">
                      {initiativeTitle}
                    </h2>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-semibold text-gray-400 block mb-1">Est. Savings</span>
                    <span className="text-lg font-bold text-emerald-600">{savingsPercentage}</span>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-4 gap-4 rounded-2xl bg-gray-50/80 p-5 mb-5">
                  <div>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Impact</span>
                    <span className="text-lg font-bold text-gray-900">{impact}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Confidence</span>
                    <span className="text-lg font-bold text-gray-900">{confidence}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Validated</span>
                    <span className="text-lg font-bold text-gray-900">{validatedCount}/{proofPoints.length}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Effort</span>
                    <span className="text-lg font-bold text-gray-900">{effort}</span>
                  </div>
                </div>

                {/* Risk & ESG */}
                <div className="flex items-center gap-8 px-1">
                  <div className="flex items-center gap-2 group relative">
                    <span className="text-[13px] font-medium text-gray-500">Risk:</span>
                    <span className={`text-[13px] font-bold ${riskImpact.score < 0 ? 'text-emerald-600' : riskImpact.score > 0 ? 'text-red-600' : 'text-gray-900'}`}>{risk}</span>
                    {riskImpact.score < 0 ? (
                      <ChevronDown className="h-4 w-4 text-emerald-500" />
                    ) : riskImpact.score > 0 ? (
                      <ChevronUp className="h-4 w-4 text-red-500" />
                    ) : (
                      <span className="text-[13px] text-gray-400">~</span>
                    )}
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50">
                      <div className="bg-gray-900 text-white text-[11px] rounded-lg p-3 w-64 shadow-lg">
                        <p className="font-semibold mb-2">Risk Impact Breakdown</p>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span>Concentration:</span>
                            <span>{riskImpact.breakdown.concentrationRisk > 0 ? '+' : ''}{riskImpact.breakdown.concentrationRisk}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Financial:</span>
                            <span>{riskImpact.breakdown.financialRisk > 0 ? '+' : ''}{riskImpact.breakdown.financialRisk}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Geopolitical:</span>
                            <span>{riskImpact.breakdown.geopoliticalRisk > 0 ? '+' : ''}{riskImpact.breakdown.geopoliticalRisk}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Price Volatility:</span>
                            <span>{riskImpact.breakdown.priceVolatilityRisk > 0 ? '+' : ''}{riskImpact.breakdown.priceVolatilityRisk}</span>
                          </div>
                        </div>
                        <p className="mt-2 text-gray-300 text-[10px]">{riskImpact.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 group relative">
                    <span className="text-[13px] font-medium text-gray-500">ESG:</span>
                    <span className={`text-[13px] font-bold ${esgImpact.score > 0 ? 'text-emerald-600' : esgImpact.score < 0 ? 'text-red-600' : 'text-gray-900'}`}>{esg}</span>
                    {esgImpact.score > 0 ? (
                      <ChevronUp className="h-4 w-4 text-emerald-500" />
                    ) : esgImpact.score < 0 ? (
                      <ChevronDown className="h-4 w-4 text-red-500" />
                    ) : (
                      <span className="text-[13px] text-gray-400">~</span>
                    )}
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50">
                      <div className="bg-gray-900 text-white text-[11px] rounded-lg p-3 w-64 shadow-lg">
                        <p className="font-semibold mb-2">ESG Impact Breakdown</p>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span>Environmental:</span>
                            <span>{esgImpact.breakdown.environmental > 0 ? '+' : ''}{esgImpact.breakdown.environmental}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Social:</span>
                            <span>{esgImpact.breakdown.social > 0 ? '+' : ''}{esgImpact.breakdown.social}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Governance:</span>
                            <span>{esgImpact.breakdown.governance > 0 ? '+' : ''}{esgImpact.breakdown.governance}</span>
                          </div>
                        </div>
                        <p className="mt-2 text-gray-300 text-[10px]">{esgImpact.description}</p>
                      </div>
                    </div>
                  </div>
                  {totalSpend > 0 && (
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-[13px] font-medium text-gray-500">Total Spend:</span>
                      <span className="text-[13px] font-bold text-gray-900">{formatCurrency(totalSpend)}</span>
                    </div>
                  )}
                </div>
              </motion.section>

              {/* What did I find? */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-gray-100"
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-gray-900">What did I find?</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      AI Powered
                    </span>
                    <ChevronUp className="h-5 w-5 text-gray-400 cursor-pointer" />
                  </div>
                </div>

                <div className="mb-6 text-[14px] text-gray-600 leading-relaxed">
                  <p>{getDetailedInsightText()}</p>
                </div>

                <div className="flex gap-6">
                  {/* Chart Area - Vertical Bar Graph */}
                  <div className="flex-1 space-y-4">
                    <h4 className="text-[14px] font-semibold text-gray-900">{getChartTitle()}</h4>

                    {/* Vertical Bar Chart */}
                    <div className="relative">
                      {(() => {
                        const maxSpend = Math.max(...topSuppliers.map(s => s.spend), 1);
                        const colors = [
                          { bar: 'from-blue-400 to-blue-600', glow: 'shadow-blue-200', text: 'text-blue-600' },
                          { bar: 'from-purple-400 to-purple-600', glow: 'shadow-purple-200', text: 'text-purple-600' },
                          { bar: 'from-emerald-400 to-emerald-600', glow: 'shadow-emerald-200', text: 'text-emerald-600' },
                          { bar: 'from-amber-400 to-amber-600', glow: 'shadow-amber-200', text: 'text-amber-600' },
                          { bar: 'from-rose-400 to-rose-600', glow: 'shadow-rose-200', text: 'text-rose-600' },
                        ];

                        return (
                          <div className="relative h-[200px] flex items-end justify-between gap-3 px-2 pt-8 pb-2">
                            {/* Y-axis labels */}
                            <div className="absolute left-0 top-8 bottom-8 w-12 flex flex-col justify-between text-[10px] font-medium text-gray-400">
                              <span>{formatCurrency(maxSpend)}</span>
                              <span>{formatCurrency(maxSpend * 0.5)}</span>
                              <span>$0</span>
                            </div>

                            {/* Grid lines */}
                            <div className="absolute left-14 right-0 top-8 bottom-8">
                              {[0, 1, 2].map((i) => (
                                <div
                                  key={i}
                                  className="absolute left-0 right-0 border-t border-dashed border-gray-200"
                                  style={{ top: `${i * 50}%` }}
                                />
                              ))}
                            </div>

                            {/* Bars */}
                            <div className="flex-1 flex items-end justify-around gap-2 ml-14 h-[160px]">
                              {topSuppliers.slice(0, 5).map((supplier, idx) => {
                                const percentage = maxSpend > 0 ? (supplier.spend / maxSpend) * 100 : 0;
                                const spendPercentOfTotal = totalSpend > 0 ? ((supplier.spend / totalSpend) * 100).toFixed(0) : '0';
                                const color = colors[idx % colors.length];

                                return (
                                  <div key={idx} className="flex flex-col items-center gap-2 flex-1 max-w-[80px] group">
                                    {/* Value label on top */}
                                    <motion.div
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: idx * 0.1 + 0.5, duration: 0.3 }}
                                      className="text-center"
                                    >
                                      <span className={`text-[11px] font-bold ${color.text}`}>
                                        {formatCurrency(supplier.spend)}
                                      </span>
                                    </motion.div>

                                    {/* Bar */}
                                    <div className="relative w-full flex justify-center" style={{ height: '140px' }}>
                                      <motion.div
                                        className={`w-10 rounded-t-lg bg-gradient-to-t ${color.bar} shadow-lg ${color.glow} relative overflow-hidden cursor-pointer`}
                                        initial={{ height: 0 }}
                                        animate={{ height: `${percentage}%` }}
                                        transition={{ delay: idx * 0.1, duration: 0.8, ease: "easeOut" }}
                                        whileHover={{ scale: 1.05 }}
                                      >
                                        {/* Shine effect */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0" />
                                        {/* Percentage badge */}
                                        <div className="absolute inset-x-0 top-2 flex justify-center">
                                          <span className="text-[9px] font-bold text-white/90">{spendPercentOfTotal}%</span>
                                        </div>
                                      </motion.div>
                                    </div>

                                    {/* Supplier name */}
                                    <div className="w-full text-center">
                                      <span className="text-[10px] font-medium text-gray-600 truncate block max-w-[70px] mx-auto" title={supplier.name}>
                                        {supplier.name.length > 10 ? supplier.name.substring(0, 10) + '...' : supplier.name}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Summary Stats */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6, duration: 0.4 }}
                        className="mt-4 flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-50 via-purple-50 to-emerald-50 border border-gray-100"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <span className="text-[10px] font-medium text-gray-500 block">Top 3 Share</span>
                            <span className="text-[14px] font-bold text-gray-900">
                              {totalSpend > 0
                                ? ((topSuppliers.slice(0, 3).reduce((sum, s) => sum + s.spend, 0) / totalSpend) * 100).toFixed(0)
                                : computedMetrics?.top3Concentration?.toFixed(0) || '65'}%
                            </span>
                          </div>
                          <div className="h-8 w-px bg-gray-200" />
                          <div className="text-center">
                            <span className="text-[10px] font-medium text-gray-500 block">Suppliers</span>
                            <span className="text-[14px] font-bold text-gray-900">{topSuppliers.length}</span>
                          </div>
                          <div className="h-8 w-px bg-gray-200" />
                          <div className="text-center">
                            <span className="text-[10px] font-medium text-gray-500 block">Total Spend</span>
                            <span className="text-[14px] font-bold text-gray-900">{formatCurrency(totalSpend)}</span>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>

                  {/* Info Boxes */}
                  <div className="w-[260px] space-y-4">
                    {/* Savings Potential Card */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 }}
                      className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg shadow-emerald-200"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider opacity-90">Savings Potential</span>
                      </div>
                      <div className="text-3xl font-bold mb-1">{savingsPercentage}</div>
                      <p className="text-[11px] opacity-80 leading-relaxed">
                        of addressable spend ({formatCurrency(totalSpend)})
                      </p>
                    </motion.div>

                    {/* Confidence Card */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 }}
                      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Confidence</span>
                        <span className={`text-[20px] font-bold ${
                          confidence >= 80 ? 'text-emerald-600' :
                          confidence >= 50 ? 'text-amber-600' : 'text-red-500'
                        }`}>{confidence}%</span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden mb-3">
                        <motion.div
                          className={`h-full rounded-full ${
                            confidence >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                            confidence >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                            'bg-gradient-to-r from-red-400 to-red-500'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${confidence}%` }}
                          transition={{ delay: 0.5, duration: 0.8 }}
                        />
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        {validatedCount}/{proofPoints.length} proof points validated
                      </p>
                    </motion.div>
                  </div>
                </div>
              </motion.section>

              {/* How did I test? */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-gray-100"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-gray-900">How did I test:</h2>
                  <ChevronUp className="h-5 w-5 text-gray-400 cursor-pointer" />
                </div>

                <div className="space-y-4">
                  {tests.map((test, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      </div>
                      <span className="text-[13px] text-gray-600 leading-relaxed italic">
                        {test.replace(/\{category\}/g, categoryName)}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.section>

              {/* What I Recommend */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-gray-100"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-gray-900">What I Recommend</h2>
                    {!isLoadingRecommendations && selectedRecommendations.size > 0 && (
                      <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                        {selectedRecommendations.size} selected
                      </span>
                    )}
                  </div>
                  {isLoadingRecommendations && (
                    <div className="flex items-center gap-2 text-[11px] text-blue-600">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Analyzing your data...</span>
                    </div>
                  )}
                  {!isLoadingRecommendations && !recommendationsError && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          // Select all non-monitoring recommendations
                          const allIndices = new Set<number>();
                          llmRecommendations.forEach((rec, idx) => {
                            const isMonitoringMessage = rec.toLowerCase().includes('monitor') && rec.toLowerCase().includes('alert');
                            if (!(isMonitoringMessage && idx === llmRecommendations.length - 1)) {
                              allIndices.add(idx);
                            }
                          });
                          setSelectedRecommendations(allIndices);
                        }}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors px-2 py-1 rounded hover:bg-blue-50"
                      >
                        Select All
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => setSelectedRecommendations(new Set())}
                        className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 transition-colors px-2 py-1 rounded hover:bg-gray-100"
                      >
                        Clear All
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3 mb-6">
                  {isLoadingRecommendations ? (
                    // Loading skeleton
                    Array.from({ length: 4 }).map((_, idx) => (
                      <div key={idx} className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4 animate-pulse">
                        <div className="h-6 w-6 rounded-md bg-gray-200" />
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 rounded w-3/4" />
                        </div>
                      </div>
                    ))
                  ) : (
                    // LLM-generated recommendations - clickable with numbered format
                    llmRecommendations.map((rec, idx) => {
                      // Skip the last one if it's the monitoring message (we show it separately)
                      const isMonitoringMessage = rec.toLowerCase().includes('monitor') && rec.toLowerCase().includes('alert');
                      if (isMonitoringMessage && idx === llmRecommendations.length - 1) return null;

                      const isSelected = selectedRecommendations.has(idx);
                      const displayNumber = idx + 1;

                      return (
                        <motion.div
                          key={idx}
                          onClick={() => {
                            const newSelected = new Set(selectedRecommendations);
                            if (isSelected) {
                              newSelected.delete(idx);
                            } else {
                              newSelected.add(idx);
                            }
                            setSelectedRecommendations(newSelected);
                          }}
                          whileTap={{ scale: 0.98 }}
                          className={`flex items-start gap-4 rounded-xl border-2 p-4 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                              : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50/50'
                          }`}
                        >
                          {/* Numbered checkbox */}
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600'
                              : 'bg-white border-gray-300 hover:border-blue-400'
                          }`}>
                            {isSelected ? (
                              <Check className="h-4 w-4 text-white" />
                            ) : (
                              <span className="text-[12px] font-bold text-gray-400">{displayNumber}</span>
                            )}
                          </div>
                          {/* Recommendation text */}
                          <div className="flex-1">
                            <p className={`text-[13px] font-medium leading-relaxed transition-colors ${
                              isSelected ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {rec}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>

                <p className="text-[13px] font-medium text-gray-500 mb-8">
                  {llmRecommendations.find(r => r.toLowerCase().includes('monitor') && r.toLowerCase().includes('alert')) ||
                   "I will monitor market conditions and alert you on significant changes (±5% threshold)."}
                </p>

                <div className="flex items-center justify-between">
                  <div className="text-[12px] text-gray-500">
                    {selectedRecommendations.size === 0 ? (
                      <span>Click recommendations to select</span>
                    ) : (
                      <span className="text-blue-600 font-medium">
                        {selectedRecommendations.size} recommendation{selectedRecommendations.size !== 1 ? 's' : ''} selected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => router.push("/opportunities")}
                      className="h-11 px-6 rounded-xl text-[14px] font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      Ignore
                    </button>
                    <button className="h-11 px-6 rounded-xl bg-blue-100 flex items-center gap-2 text-[14px] font-semibold text-blue-700 hover:bg-blue-200 transition-colors">
                      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                        <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                        <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                        <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                        <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                      Simulate
                    </button>
                    <button
                      onClick={() => {
                        // Save the accepted recommendations data to context
                        const selectedRecs = llmRecommendations.filter((_, idx) => selectedRecommendations.has(idx));
                        const acceptedData: AcceptedRecommendationsData = {
                          opportunityId: oppId,
                          opportunityName: opportunity?.name || initiativeTitle,
                          categoryName,
                          locations: categoryLocations,
                          totalSpend,
                          recommendations: selectedRecs,
                          proofPoints: proofPoints.map(pp => ({
                            id: pp.id,
                            name: pp.name,
                            isValidated: pp.isValidated
                          })),
                          suppliers: topSuppliers,
                          metrics: {
                            priceVariance: computedMetrics?.priceVariance,
                            top3Concentration: computedMetrics?.top3Concentration,
                            tailSpendPercentage: computedMetrics?.tailSpendPercentage,
                            supplierCount: computedMetrics?.supplierCount || topSuppliers.length
                          },
                          savingsEstimate: savingsPercentage,
                          acceptedAt: Date.now()
                        };
                        actions.setAcceptedRecommendations(acceptedData);

                        // Add activity
                        actions.addActivity({
                          type: "validation",
                          title: `Accepted: ${opportunity?.name || initiativeTitle}`,
                          description: `Accepted ${selectedRecs.length} recommendations for ${categoryName}`,
                          metadata: { categoryName, savings: savingsPercentage }
                        });

                        router.push("/opportunities/accepted");
                      }}
                      disabled={selectedRecommendations.size === 0}
                      className={`h-11 px-8 rounded-xl text-[14px] font-semibold shadow-lg transition-all flex items-center gap-2 ${
                        selectedRecommendations.size > 0
                          ? 'bg-gray-900 text-white hover:bg-black'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Accept
                      {selectedRecommendations.size > 0 && (
                        <span className="bg-white/20 px-1.5 py-0.5 rounded text-[11px]">
                          {selectedRecommendations.size}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </motion.section>

            </div>
          </div>
        </div>
      </div>

      {/* Background Decor */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute bottom-[-20%] left-[-10%] h-[70%] w-[55%] rotate-[-12deg] overflow-hidden bg-[#E5B800] shadow-2xl opacity-40">
          <div className="absolute inset-0 flex flex-col space-y-6 pt-12">
            {Array.from({ length: 25 }).map((_, i) => (
              <div key={i} className="h-[2px] w-full bg-black/5" />
            ))}
          </div>
          <div className="absolute top-6 left-0 h-[2px] w-full bg-white/30" />
          <div className="absolute top-12 left-0 h-[2px] w-full bg-white/20" />
        </div>
      </div>
    </div>
  );
}
