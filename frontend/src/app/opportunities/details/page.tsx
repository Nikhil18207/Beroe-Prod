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
import type { ProofPoint } from "@/context/AppContext";
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

  // Get data from context
  const categoryName = state.setupData.categoryName || "Edible Oils";
  const setupOpportunities = state.setupOpportunities;
  const computedMetrics = state.computedMetrics;
  const totalSpend = state.setupData.spend || 0;
  const goals = state.setupData.goals || { cost: 60, risk: 25, esg: 15 };

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

  // Extract top suppliers from context (parsed CSV data or computed metrics)
  const topSuppliers = useMemo(() => {
    // Try to get from computed metrics or use defaults
    if (computedMetrics && typeof computedMetrics === 'object') {
      // If we have supplier data in metrics
      return ["Asia Pacific Grains", "Pacific Rim Cereals", "EuroGrain Trading"];
    }
    return ["Top Supplier 1", "Top Supplier 2", "Top Supplier 3"];
  }, [computedMetrics]);

  // Get recommendations
  const recommendations = getRecommendations(oppId, categoryName, topSuppliers);

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

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Max AI Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-purple-500">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-semibold text-gray-900">Max AI</h3>
                <p className="text-[11px] text-gray-500">Procurement Intelligence Assistant</p>
              </div>
              <div className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
                confidence >= 80 ? 'bg-emerald-100 text-emerald-700' :
                confidence >= 50 ? 'bg-yellow-100 text-yellow-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {confidence}% Confidence
              </div>
            </div>

            {/* Chat Messages - Primary Focus (no inner scroll) */}
            <div className="space-y-4">
              {/* Welcome message with first question */}
              {chatMessages.length === 0 && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-purple-500">
                      <span className="text-white font-bold text-[8px]">M</span>
                    </div>
                    <span className="text-[10px] font-semibold uppercase text-gray-400">Max AI</span>
                  </div>
                  <p className="text-[13px] text-gray-700 leading-relaxed">
                    {getInsightText()}
                  </p>
                </div>
              )}

              {/* MCQ Question for current unvalidated proof point */}
              {currentQuestion && showMCQ && currentProofPointToValidate && (
                <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm">
                  <p className="text-[11px] text-blue-600 font-medium mb-2">
                    Validating: {currentProofPointToValidate.name}
                  </p>
                  <p className="text-[13px] font-medium text-gray-800 mb-4 leading-relaxed">
                    {currentQuestion.question}
                  </p>
                  <div className="space-y-2">
                    {currentQuestion.options.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleMCQAnswer(currentProofPointToValidate.id, idx, option)}
                        disabled={isLoading}
                        className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-[12px] text-gray-700 disabled:opacity-50"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* If all proof points validated, show success */}
              {unvalidatedProofPoints.length === 0 && chatMessages.length > 0 && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <p className="text-[13px] text-emerald-700 font-medium">
                    🎉 All proof points validated! Confidence is at 100%.
                  </p>
                </div>
              )}

              {/* Chat Messages - flows naturally with the page */}
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
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
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 mr-4">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-purple-500">
                    <Loader2 className="h-3 w-3 animate-spin text-white" />
                  </div>
                  <span className="text-[13px] text-gray-500">Max is thinking...</span>
                </div>
              )}

              {/* Hint for unvalidated proof points - show after questions done */}
              {!showMCQ && unvalidatedProofPoints.length > 0 && chatMessages.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-[11px] text-amber-700">
                    💡 Ask me about "{unvalidatedProofPoints[0].name}" to validate it and increase confidence further.
                  </p>
                </div>
              )}
            </div>

            {/* Proof Points Status */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">
                  Proof Points ({validatedCount}/{proofPoints.length})
                </h4>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  confidence >= 80 ? 'bg-emerald-100 text-emerald-700' :
                  confidence >= 50 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {confidence}% Confidence
                </span>
              </div>
              <div className="space-y-2">
                {proofPoints.map((pp, idx) => (
                  <div key={idx} className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                    !pp.isValidated ? 'bg-amber-50 border border-amber-100' : ''
                  } ${validatingProofPointId === pp.id ? 'ring-2 ring-blue-300' : ''}`}>
                    <div className="flex items-center gap-2">
                      {pp.isValidated ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                      )}
                      <span className={`text-[12px] ${pp.isValidated ? 'text-gray-700' : 'text-amber-700 font-medium'}`}>
                        {pp.name}
                      </span>
                    </div>
                    {!pp.isValidated && (
                      <button
                        onClick={() => handleManualValidate(pp.id)}
                        className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                      >
                        Validate
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {unvalidatedProofPoints.length > 0 && (
                <p className="text-[11px] text-amber-600 bg-amber-50 p-2 rounded-lg">
                  💡 Ask Max about "{unvalidatedProofPoints[0].name}" to validate it and increase confidence
                </p>
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
                  {/* Chart Area */}
                  <div className="flex-1 space-y-3">
                    <h4 className="text-[14px] font-semibold text-gray-900">{getChartTitle()}</h4>
                    <div className="relative h-[220px] w-full">
                      {/* Y-axis labels */}
                      <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between text-[10px] font-medium text-gray-400">
                        <span>100%</span>
                        <span>75%</span>
                        <span>50%</span>
                        <span>25%</span>
                        <span>0%</span>
                      </div>

                      {/* Chart */}
                      <div className="absolute left-10 right-0 top-0 bottom-6 border-l border-b border-gray-200">
                        <svg className="h-full w-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                          {/* Grid lines */}
                          {[0, 50, 100, 150].map((y, i) => (
                            <line key={i} x1="0" y1={y} x2="400" y2={y} stroke="#f0f0f0" strokeWidth="1" />
                          ))}

                          {/* Chart line */}
                          <motion.path
                            d="M 0 180 L 80 160 L 160 120 L 240 80 L 320 50 L 400 30"
                            fill="none"
                            stroke="#3B82F6"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 1.5, ease: "easeInOut" }}
                          />
                        </svg>
                      </div>

                      {/* X-axis labels */}
                      <div className="absolute bottom-0 left-10 right-0 flex justify-between text-[11px] font-medium text-gray-400">
                        <span>Jan 24</span>
                        <span>Jun 24</span>
                        <span>Jan 25</span>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="flex gap-2 pt-2 pl-10 flex-wrap">
                      {topSuppliers.slice(0, 3).map((supplier, idx) => (
                        <span key={idx} className="text-[9px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded truncate max-w-[120px]">
                          {supplier}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Info Boxes */}
                  <div className="w-[280px] space-y-4">
                    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                      <p className="text-[12px] leading-relaxed text-gray-600">
                        Based on your spend data analysis, implementing this initiative could generate {savingsPercentage} savings on addressable spend.
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                      <p className="text-[12px] leading-relaxed text-gray-600">
                        {validatedCount} of {proofPoints.length} proof points validated. Answer more questions to increase confidence and narrow savings range.
                      </p>
                    </div>
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
                <h2 className="text-lg font-bold text-gray-900 mb-6">What I Recommend</h2>

                <div className="space-y-3 mb-6">
                  {recommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 hover:bg-gray-50/50 transition-colors cursor-pointer">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors ${rec.checked ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-300'}`}>
                        {rec.checked && <Check className="h-4 w-4 text-white" />}
                      </div>
                      <span className="text-[13px] font-semibold text-gray-900">{rec.text}</span>
                    </div>
                  ))}
                </div>

                <p className="text-[13px] font-medium text-gray-500 mb-8">
                  I will monitor market conditions and alert you on significant changes (±5% threshold).
                </p>

                <div className="flex items-center justify-end gap-3">
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
                    onClick={() => router.push("/opportunities/accepted")}
                    className="h-11 px-8 rounded-xl bg-gray-900 text-[14px] font-semibold text-white shadow-lg hover:bg-black transition-all"
                  >
                    Accept
                  </button>
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
