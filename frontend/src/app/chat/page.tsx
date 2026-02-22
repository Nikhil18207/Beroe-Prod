"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  Plus,
  Mic,
  Send,
  FileText,
  X,
  Clock,
  Info,
  TrendingUp,
  Download
} from "lucide-react";
import React, { useState, useEffect, Suspense, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import Sidebar from "@/components/Sidebar";

// Unique ID generator to prevent duplicate React keys
let messageIdCounter = 0;
const generateMessageId = () => `msg-${Date.now()}-${++messageIdCounter}`;

// Types for different panel states
type PanelState =
  | "empty"
  | "updating_profile"
  | "risk_profile"
  | "spend_overview"
  | "analysing_documents"
  | "category_summary"
  | "top_opportunity"
  | "opportunity_rationale"
  | "analysing_levers"
  | "simulation_mode";

// Sample data
const relevantOpportunities = [
  {
    id: "1",
    title: "Vegetable Oils ESG Compliance Enhance...",
    description: "Current supplier ESG assessment reveals significant compliance gaps: carbon emissions reporting incomplete, labor standards documen...",
    savingsImpact: "Mid",
    effort: "1 week",
    time: "Just Now"
  },
  {
    id: "2",
    title: "Consolidate Spend with Top Performers",
    description: "You have 5 suppliers for Office Supplies in North America with similar performance ratings. Consolidating 80% of your $450K annual spend...",
    savingsImpact: "High",
    effort: "0-3 months",
    time: "Just Now"
  }
];

function ChatPage() {
  const { state } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    thinkingTime?: string;
    isItalic?: boolean;
    attachments?: Array<{ name: string; size: string; type: "pdf" | "xlsx" }>;
    summaryCard?: {
      title: string;
      category: string;
      description: string;
    };
    opportunityCard?: {
      title: string;
      description: string;
      showMore?: boolean;
    };
    artifactCard?: {
      title: string;
      description: string;
    };
    sourcingMixCard?: boolean;
  }>>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [panelState, setPanelState] = useState<PanelState>("empty");
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; size: string }>>([]);
  const [expandedOpportunity, setExpandedOpportunity] = useState(true);
  const {
    selectedCountry,
    malaysiaPercent,
    indonesiaPercent
  } = state.simulationSettings;

  const userName = state.user?.name || "User";

  // Dynamic cost calculation based on simulation settings
  const calculateDynamicCosts = () => {
    // Use spendAnalysis (filtered by category) first, then fallback
    const totalSpend = state.spendAnalysis?.totalSpend || state.setupData.spend || 50000000;
    const malaysiaFactor = malaysiaPercent / 100;
    const indonesiaFactor = indonesiaPercent / 100;

    // Base cost components (per MT)
    const baseComponents = {
      fob: 1120,
      freight: 85,
      taxes: 45,
      duty: 32
    };

    // Malaysia costs (cheaper than India)
    const malaysiaCosts = {
      fob: baseComponents.fob * 0.933, // 6.7% cheaper
      freight: baseComponents.freight * 1.082, // 8.2% more expensive
      taxes: baseComponents.taxes * 0.844, // 15.6% cheaper
      duty: baseComponents.duty * 0.562 // 43.8% cheaper
    };

    // Indonesia costs
    const indonesiaCosts = {
      fob: baseComponents.fob * 0.96, // 4% cheaper
      freight: baseComponents.freight * 0.835, // 16.5% cheaper
      taxes: baseComponents.taxes * 0.978, // 2.2% cheaper
      duty: baseComponents.duty * 0 // No duty
    };

    // Canada costs (for comparison)
    const canadaCosts = {
      fob: baseComponents.fob * 0.96, // 4% cheaper
      freight: baseComponents.freight * 0.835, // 16.5% cheaper
      taxes: baseComponents.taxes * 0.933, // 6.7% cheaper
      duty: baseComponents.duty * 0 // No duty
    };

    // Calculate blended costs based on slider allocation
    const blendedCosts = {
      fob: (malaysiaCosts.fob * malaysiaFactor) + (indonesiaCosts.fob * indonesiaFactor),
      freight: (malaysiaCosts.freight * malaysiaFactor) + (indonesiaCosts.freight * indonesiaFactor),
      taxes: (malaysiaCosts.taxes * malaysiaFactor) + (indonesiaCosts.taxes * indonesiaFactor),
      duty: (malaysiaCosts.duty * malaysiaFactor) + (indonesiaCosts.duty * indonesiaFactor)
    };

    const blendedTotal = blendedCosts.fob + blendedCosts.freight + blendedCosts.taxes + blendedCosts.duty;
    const indiaTotal = baseComponents.fob + baseComponents.freight + baseComponents.taxes + baseComponents.duty;
    const comparisonTotal = selectedCountry === "australia" ? blendedTotal : canadaCosts.fob + canadaCosts.freight + canadaCosts.taxes + canadaCosts.duty;

    return {
      india: {
        fob: baseComponents.fob,
        freight: baseComponents.freight,
        taxes: baseComponents.taxes,
        duty: baseComponents.duty,
        total: indiaTotal
      },
      blended: {
        fob: blendedCosts.fob,
        freight: blendedCosts.freight,
        taxes: blendedCosts.taxes,
        duty: blendedCosts.duty,
        total: blendedTotal
      },
      comparison: selectedCountry === "australia" ? blendedCosts : canadaCosts,
      comparisonTotal,
      savings: indiaTotal - comparisonTotal,
      savingsPct: ((indiaTotal - comparisonTotal) / indiaTotal) * 100
    };
  };

  const costs = calculateDynamicCosts();

  // Get current date formatted
  const getCurrentDate = () => {
    const now = new Date();
    return `12:35 PM SEPT 24, 2025`;
  };

  // Simulate conversation flow
  const simulateConversation = (step: number) => {
    switch (step) {
      case 1:
        // Initial AI response
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          setMessages(prev => [...prev, {
            id: generateMessageId(),
            role: "assistant",
            content: "Got it. Before I dive in—can I check your priority? Do you want me to focus more on **risk factors**, **ESG**, or **balance both**?",
            timestamp: "12:30 PM",
            thinkingTime: "1m 13s"
          }]);
        }, 1500);
        break;

      case 2:
        // After user says "Risk and ESG"
        setPanelState("updating_profile");
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          setMessages(prev => [...prev, {
            id: generateMessageId(),
            role: "assistant",
            content: "Thanks. I'll save this as your preference for future sessions. I understand **resilience and sustainability** are top priorities for you.\n\nFrom your profile, I see your year-on-year spend is about **$45.2M** on **vegetable oils**.\n\n*Is there anything else you'd like me to factor in—like contracts ending soon, or specific sourcing preferences — so I can get you more targeted actions?*",
            timestamp: "12:35 PM",
            thinkingTime: "22s",
            isItalic: true
          }]);
          setTimeout(() => {
            setPanelState("spend_overview");
          }, 1000);
        }, 2000);
        break;

      case 3:
        // After user uploads documents
        setPanelState("analysing_documents");
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          setMessages(prev => [...prev, {
            id: generateMessageId(),
            role: "assistant",
            content: "Based on the documents provided.\n\nNew trade, supplier, and market data have been processed. I have recalibrated insights for the Vegetable Oils category, incorporating recent pricing, supplier compliance reports, and import/export updates.\n\n**Here is your category summary for vegetable oils**",
            timestamp: "12:35 PM",
            thinkingTime: "1m 13s",
            summaryCard: {
              title: "Category Summary",
              category: "Vegetable Oils",
              description: "New trade, supplier, and market data uploaded on October 16, 2025, have been processed. Max has recalibrated insights for the Vegetable Oils category, incorporating recent pricing, sup..."
            }
          }]);
          // Add follow-up question
          setTimeout(() => {
            setMessages(prev => [...prev, {
              id: generateMessageId(),
              role: "assistant",
              content: "*Do you want to view the top Opportunity area*",
              timestamp: "",
              isItalic: true
            }]);
          }, 500);
          setTimeout(() => {
            setPanelState("category_summary");
          }, 1000);
        }, 3000);
        break;

      case 4:
        // After user asks for opportunities
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          setMessages(prev => [...prev, {
            id: generateMessageId(),
            role: "assistant",
            content: "Here is the top Opportunity for **Vegetable Oils**",
            timestamp: "12:35 PM",
            thinkingTime: "1m 13s",
            opportunityCard: {
              title: "Consolidate Spend with Top Performers",
              description: "Heavy reliance on India (>90% of spend) limits sourcing flexibility and misses cost-saving opportunities available in other Southeast Asian markets. This concentration reduces a...",
              showMore: true
            }
          }]);
          setMessages(prev => [...prev, {
            id: generateMessageId(),
            role: "assistant",
            content: "*Do you want to understand more about this opportunity and explore how to take it further?*",
            timestamp: "",
            isItalic: true
          }]);
          setTimeout(() => {
            setPanelState("top_opportunity");
          }, 500);
        }, 2000);
        break;

      case 5:
        // After user says "Yes, please" to explore opportunity further
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          setMessages(prev => [...prev, {
            id: generateMessageId(),
            role: "assistant",
            content: "Below are the artifacts and sources for **Diversify Vegetable Oil Sourcing**",
            timestamp: "12:36 PM",
            thinkingTime: "1m 13s"
          }]);
          // Add first artifact card after a short delay
          setTimeout(() => {
            setMessages(prev => [...prev, {
              id: generateMessageId(),
              role: "assistant",
              content: "",
              timestamp: "",
              artifactCard: {
                title: "What Did I find",
                description: "While analyzing new supplier and trade documents uploaded on October 16, 2025, Max detected an unusual geographic concentration in sourcing behavior: Over 90% of total categor..."
              }
            }]);
          }, 300);
          // Add second artifact card
          setTimeout(() => {
            setMessages(prev => [...prev, {
              id: generateMessageId(),
              role: "assistant",
              content: "",
              timestamp: "",
              artifactCard: {
                title: "Why is this an opportunity?",
                description: "Volume consolidation is one of the most reliable cost reduction strategies in procurement. Based on similar companies in your industry, consolidating spend with fewer suppliers typically yi..."
              }
            }]);
          }, 500);
          // Add follow-up question
          setTimeout(() => {
            setMessages(prev => [...prev, {
              id: generateMessageId(),
              role: "assistant",
              content: "*Do you want to understand more about this opportunity and explore how to take it further?*",
              timestamp: "",
              isItalic: true
            }]);
          }, 700);
          setTimeout(() => {
            setPanelState("opportunity_rationale");
          }, 500);
        }, 2000);
        break;

      case 6:
        // After user says "Lets simulate this opportunity"
        setPanelState("analysing_levers");
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          setMessages(prev => [...prev, {
            id: generateMessageId(),
            role: "assistant",
            content: "I've modeled a comparative sourcing scenario for Vegetable Oils based on your current contracts, freight data, and the latest trade benchmarks. The simulation compares India (current baseline) with Malaysia and Indonesia across cost, risk, ESG, and logistics dimensions.",
            timestamp: "12:37 PM",
            thinkingTime: "1m 13s"
          }]);
          // Add sourcing mix card after a short delay
          setTimeout(() => {
            setMessages(prev => [...prev, {
              id: generateMessageId(),
              role: "assistant",
              content: "",
              timestamp: "",
              sourcingMixCard: true
            }]);
          }, 300);
          setTimeout(() => {
            setPanelState("simulation_mode");
          }, 500);
        }, 3000);
        break;
    }
  };

  // Get initial query from URL params
  useEffect(() => {
    const query = searchParams.get("q");
    if (query) {
      setMessages([{
        id: generateMessageId(),
        role: "user",
        content: query,
        timestamp: "12:30 PM"
      }]);
      simulateConversation(1);
    }
  }, [searchParams]);

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Allow submit if there's text OR files
    if (chatInput.trim() || uploadedFiles.length > 0) {
      const hasFiles = uploadedFiles.length > 0;
      const userMessage = {
        id: generateMessageId(),
        role: "user" as const,
        content: chatInput.trim() || "Here you go",
        timestamp: "12:35 PM",
        attachments: hasFiles ? uploadedFiles.map(f => ({ ...f, type: f.name.endsWith('.pdf') ? 'pdf' as const : 'xlsx' as const })) : undefined
      };
      setMessages(prev => [...prev, userMessage]);

      const input = chatInput.toLowerCase();
      setChatInput("");
      setUploadedFiles([]);

      // Determine which step based on input or files
      if (input.includes("risk") || input.includes("esg")) {
        simulateConversation(2);
      } else if (hasFiles || input.includes("here you go")) {
        // If files were uploaded, trigger document analysis
        simulateConversation(3);
      } else if (input.includes("simulate") || input.includes("let's simulate") || input.includes("lets simulate")) {
        // User wants to simulate the opportunity
        simulateConversation(6);
      } else if (input.includes("yes, please") || input.includes("yes please") || (input.includes("yes") && panelState === "top_opportunity")) {
        // User wants to explore opportunity further
        simulateConversation(5);
      } else if (input.includes("opportunity") || input.includes("yes")) {
        simulateConversation(4);
      } else {
        // Generic response
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          setMessages(prev => [...prev, {
            id: generateMessageId(),
            role: "assistant",
            content: "I understand. Let me analyze that for you.",
            timestamp: "12:35 PM",
            thinkingTime: "15s"
          }]);
        }, 1500);
      }
    }
  };

  // Parse message content for bold and italic text
  const renderMessageContent = (content: string, isItalic?: boolean) => {
    const lines = content.split('\n');
    return lines.map((line, lineIdx) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const renderedParts = parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
          return <em key={index} className="italic text-gray-600">{part.slice(1, -1)}</em>;
        }
        return part;
      });
      return (
        <span key={lineIdx}>
          {isItalic ? <em className="italic text-gray-600">{renderedParts}</em> : renderedParts}
          {lineIdx < lines.length - 1 && <br />}
        </span>
      );
    });
  };

  // Simulate file upload
  const handleFileUpload = () => {
    setUploadedFiles([
      { name: "Contract - Mediterian Food Co...", size: "2.2mb" },
      { name: "2025 Q4 - Supplier List", size: "0.6mb" }
    ]);
  };

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-gradient-to-b from-[#E8F4FC] via-[#F0F8FF] to-white">
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

      {/* Left Icon Sidebar */}
      <Sidebar user={state.user} />

      {/* Main Content - Split View */}
      <div className="relative z-30 flex flex-1 overflow-hidden">

        {/* Left Panel - Chat */}
        <div className="w-[500px] flex flex-col bg-white border-r border-gray-100 shrink-0">
          {/* Header */}
          <header className="flex h-14 items-center gap-3 border-b border-gray-100 px-5">
            <button onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100">
              <ArrowLeft className="h-4 w-4 text-gray-600" />
            </button>
            <div className="flex items-center gap-2 flex-1">
              <h1 className="text-[14px] font-semibold text-blue-600">Source from low cost locations</h1>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                {message.role === "user" ? (
                  <div className="flex flex-col items-end">
                    {/* Attachments */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="space-y-2 mb-2 w-full max-w-[320px]">
                        {message.attachments.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 ring-1 ring-gray-100">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${file.type === 'pdf' ? 'bg-red-100' : 'bg-blue-100'}`}>
                              <FileText className={`h-5 w-5 ${file.type === 'pdf' ? 'text-red-500' : 'text-blue-500'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                            </div>
                            <span className="text-xs text-gray-400">{file.size}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="bg-gray-50 rounded-2xl p-4 max-w-[85%]">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-gray-900">{userName}</span>
                        <span className="text-xs text-gray-400">{message.timestamp}</span>
                      </div>
                      <p className="text-sm text-gray-700">{message.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {message.thinkingTime && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <span className="text-sm">Thought for {message.thinkingTime}</span>
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    )}
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {renderMessageContent(message.content, message.isItalic)}
                    </p>

                    {/* Summary Card */}
                    {message.summaryCard && (
                      <div className="bg-gray-50 rounded-xl p-4 ring-1 ring-gray-100 mt-3">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                            <svg className="h-4 w-4 text-blue-600" viewBox="0 0 16 16" fill="none">
                              <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-gray-900">{message.summaryCard.title}</span>
                            <span className="text-sm text-gray-500"> for </span>
                            <span className="text-sm font-semibold text-gray-900">{message.summaryCard.category}</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">{message.summaryCard.description}</p>
                      </div>
                    )}

                    {/* Opportunity Card */}
                    {message.opportunityCard && (
                      <div className="bg-gray-50 rounded-xl p-4 ring-1 ring-gray-100 mt-3">
                        <div className="flex items-center gap-3 mb-2">
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          <span className="text-sm font-semibold text-gray-900">{message.opportunityCard.title}</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed mb-3">{message.opportunityCard.description}</p>
                        {message.opportunityCard.showMore && (
                          <button className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700">
                            Show more <ChevronDown className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Artifact Card */}
                    {message.artifactCard && (
                      <div className="bg-gray-50 rounded-xl p-4 ring-1 ring-gray-100 mt-3">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                            <svg className="h-4 w-4 text-blue-600" viewBox="0 0 16 16" fill="none">
                              <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-gray-900">{message.artifactCard.title}</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">{message.artifactCard.description}</p>
                      </div>
                    )}

                    {/* Sourcing Mix Card */}
                    {message.sourcingMixCard && (
                      <div className="bg-white rounded-xl p-5 ring-1 ring-gray-100 mt-3">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">SOURCING MIX</span>

                        {/* Malaysia Slider */}
                        <div className="mt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="h-3 w-3 rounded-full bg-blue-500" />
                            <span className="text-sm font-medium text-gray-900">Malaysia</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={malaysiaPercent}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                actions.updateSimulationSettings({
                                  malaysiaPercent: val,
                                  indonesiaPercent: 100 - val
                                });
                              }}
                              className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700 w-10">{malaysiaPercent}%</span>
                          </div>
                        </div>

                        {/* Indonesia Slider */}
                        <div className="mt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="h-3 w-3 rounded-full bg-emerald-500" />
                            <span className="text-sm font-medium text-gray-900">Indonesia</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={indonesiaPercent}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                actions.updateSimulationSettings({
                                  indonesiaPercent: val,
                                  malaysiaPercent: 100 - val
                                });
                              }}
                              className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                            <span className="text-sm font-medium text-gray-700 w-10">{indonesiaPercent}%</span>
                          </div>
                        </div>

                        {/* Add Location Button */}
                        <button className="flex items-center gap-2 mt-5 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                          <Plus className="h-4 w-4" />
                          Add Location
                        </button>

                        {/* Suggested Locations */}
                        <div className="mt-4">
                          <span className="text-xs text-gray-500">Suggested Locations</span>
                          <div className="flex items-center gap-3 mt-2">
                            <button className="text-sm text-blue-600 hover:underline">China</button>
                            <button className="text-sm text-gray-700 hover:underline">Cambodia</button>
                            <button className="text-sm text-gray-700 hover:underline">Bangkok</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}

            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-gray-400">
                <div className="flex gap-1">
                  <div className="h-2 w-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="h-2 w-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-xs">AI is thinking...</span>
              </motion.div>
            )}
          </div>

          {/* File Chips */}
          {uploadedFiles.length > 0 && (
            <div className="px-4 pb-2 flex gap-2">
              {uploadedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <span className="text-xs text-gray-700 truncate max-w-[100px]">{file.name}</span>
                  <button onClick={() => setUploadedFiles(files => files.filter((_, i) => i !== idx))}>
                    <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-gray-100">
            <form onSubmit={handleChatSubmit} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 p-[2px] shrink-0">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white">
                  <div className="h-3 w-3 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 opacity-80" />
                </div>
              </div>
              <button type="button" onClick={handleFileUpload} className="text-gray-400 hover:text-gray-600">
                <Plus className="h-5 w-5" />
              </button>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none"
              />
              <button type="button" className="text-gray-400 hover:text-gray-600">
                <Mic className="h-5 w-5" />
              </button>
              <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Right Panel - Dynamic Content */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#E8F4FC] via-[#F0F8FF] to-white">
          <div className="px-8 py-6">
            <AnimatePresence mode="wait">
              {/* Empty State */}
              {panelState === "empty" && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center h-[60vh] text-center"
                >
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 p-[3px] shadow-lg mb-6">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-white/90">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 opacity-60" />
                    </div>
                  </div>
                  <h2 className="text-xl font-medium text-gray-900 mb-2">Ask me anything</h2>
                  <p className="text-sm text-gray-500 max-w-sm">I can help you analyze risks, find opportunities, and optimize your procurement strategy.</p>
                </motion.div>
              )}

              {/* Updating Profile Loading */}
              {panelState === "updating_profile" && (
                <motion.div
                  key="updating"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center h-[60vh] text-center"
                >
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 p-[3px] shadow-lg mb-6 animate-pulse">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-white/90">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 opacity-60" />
                    </div>
                  </div>
                  <h2 className="text-xl font-medium text-gray-900 mb-2">Updating your Profile</h2>
                  <p className="text-sm text-gray-400">Reviewing Opportunities</p>
                </motion.div>
              )}

              {/* Analysing Documents Loading */}
              {panelState === "analysing_documents" && (
                <motion.div
                  key="analysing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center h-[60vh] text-center"
                >
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 p-[3px] shadow-lg mb-6 animate-pulse">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-white/90">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 opacity-60" />
                    </div>
                  </div>
                  <h2 className="text-xl font-medium text-gray-900 mb-2">Analysing Documents</h2>
                  <p className="text-sm text-gray-400">analysing spend and contracts</p>
                </motion.div>
              )}

              {/* Analysing Levers Loading */}
              {panelState === "analysing_levers" && (
                <motion.div
                  key="levers"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center h-[60vh] text-center"
                >
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 p-[3px] shadow-lg mb-6 animate-pulse">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-white/90">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 opacity-60" />
                    </div>
                  </div>
                  <h2 className="text-xl font-medium text-gray-900 mb-2">Analysing Levers</h2>
                  <p className="text-sm text-gray-400">Analysing Freight Data</p>
                </motion.div>
              )}

              {/* Simulation Mode Panel */}
              {panelState === "simulation_mode" && (
                <motion.div
                  key="simulation"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Header */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">Simulation mode</span>
                    <span className="text-xs text-gray-400 ml-2">{getCurrentDate()}</span>
                  </div>

                  {/* Opportunity Card */}
                  <div className="bg-white rounded-2xl ring-1 ring-cyan-200 overflow-hidden">
                    {/* Title Section */}
                    <div className="p-5 border-b border-gray-100">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 mt-1">
                            <CheckCircle2 className="h-5 w-5 text-teal-600" />
                          </div>
                          <div>
                            <h2 className="text-lg font-semibold text-gray-900 leading-tight pr-4">
                              Diversify Vegetable Oil Sourcing Beyond India to Capture Regional Savings and Flexibility
                            </h2>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-600 text-xs font-semibold rounded-full flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Qualified
                          </span>
                          <div className="flex items-center gap-1 text-gray-400">
                            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                              <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                            <span className="text-sm">3</span>
                          </div>
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 leading-relaxed mb-4">
                        Your current procurement strategy for vegetable oils shows a heavy reliance on Indian suppliers, accounting for over 90% of total spend. This limits sourcing flexibility and restricts the ability to capture competitive pricing and availability from nearby Southeast Asian markets such as Malaysia, Indonesia, and Thailand.
                      </p>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Very Popular</span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-500">Confidence rating:</span>
                          <div className="flex gap-0.5">
                            {[1,2].map(i => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
                            {[3,4].map(i => <Star key={i} className="h-4 w-4 text-gray-300" />)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-px bg-gray-100">
                      <div className="bg-white p-5">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">SAVINGS</span>
                        <p className="text-2xl font-bold text-gray-900 mt-1">High</p>
                      </div>
                      <div className="bg-white p-5">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">EFFORT</span>
                        <p className="text-2xl font-bold text-gray-900 mt-1">0-3 months</p>
                      </div>
                      <div className="bg-white p-5">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">RISK</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-2xl font-bold text-emerald-500">0.5</span>
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                        </div>
                      </div>
                      <div className="bg-white p-5">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">ESG</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-2xl font-bold text-emerald-500">0</span>
                          <span className="text-emerald-500">~</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Gradient Orb Indicator */}
                  <div className="flex justify-center">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 p-[2px] shadow-md">
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-white/90">
                        <div className="h-4 w-4 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 opacity-60" />
                      </div>
                    </div>
                  </div>

                  {/* Continue Button */}
                  <button className="px-8 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-black transition-colors">
                    Continue
                  </button>
                </motion.div>
              )}

              {/* Spend Overview Panel */}
              {panelState === "spend_overview" && (
                <motion.div
                  key="spend"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Header */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">Showing</span>
                    <span className="text-sm font-semibold text-gray-900">Spend Overview</span>
                    <span className="text-sm text-gray-700">for</span>
                    <span className="text-sm font-semibold text-gray-900">Vegetable Oils</span>
                    <span className="text-xs text-gray-400 ml-2">{getCurrentDate()}</span>
                  </div>

                  {/* Spend Cards */}
                  <div className="flex gap-4">
                    {/* Overall Spend Card */}
                    <div className="flex-1 bg-white rounded-2xl p-5 ring-1 ring-gray-100">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Overall Spend (Last Year)</span>
                      <div className="flex items-center gap-3 mt-2 mb-4">
                        <span className="text-3xl font-bold text-gray-900">$45.2M</span>
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-600 text-xs font-semibold rounded-full flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" /> 8.4% YoY
                        </span>
                      </div>
                      {/* Mini Chart */}
                      <div className="h-20 w-full">
                        <svg className="w-full h-full" viewBox="0 0 200 60" preserveAspectRatio="none">
                          <path d="M0 50 L20 48 L40 45 L60 42 L80 38 L100 35 L120 30 L140 25 L160 20 L180 15 L200 10" fill="none" stroke="#10B981" strokeWidth="2" />
                          <path d="M0 50 L20 48 L40 45 L60 42 L80 38 L100 35 L120 30 L140 25 L160 20 L180 15 L200 10 L200 60 L0 60 Z" fill="url(#greenGradient)" opacity="0.2" />
                          <defs>
                            <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10B981" />
                              <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                        </svg>
                      </div>
                    </div>

                    {/* Target & Year End */}
                    <div className="w-[200px] space-y-4">
                      <div className="bg-white rounded-xl p-4 ring-1 ring-gray-100">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Target Spend</span>
                          <Info className="h-3 w-3 text-gray-300" />
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-gray-900">$43M</span>
                          <span className="text-xs text-gray-500">2024 Target</span>
                        </div>
                      </div>
                      <div className="bg-white rounded-xl p-4 ring-1 ring-gray-100">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Year End Landing Spend</span>
                          <Info className="h-3 w-3 text-gray-300" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-gray-900">$45.2M</span>
                          <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-semibold rounded-full flex items-center gap-1">
                            <TrendingUp className="h-2.5 w-2.5" /> $1.2M over target
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Opportunities */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-sm text-gray-700">Showing</span>
                      <span className="text-sm font-semibold text-gray-900">Updated Relevant Opportunities</span>
                      <span className="text-xs text-gray-400 ml-2">{getCurrentDate()}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {relevantOpportunities.map((opp) => (
                        <div key={opp.id} onClick={() => router.push("/opportunities/details")} className="bg-white rounded-2xl p-5 ring-1 ring-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
                              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            </div>
                            <span className="text-xs text-gray-400">{opp.time}</span>
                          </div>
                          <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-1">{opp.title}</h3>
                          <p className="text-xs text-gray-500 mb-4 line-clamp-2">{opp.description}</p>
                          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                            <div>
                              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider block">Savings Impact</span>
                              <span className="text-sm font-bold text-gray-900">{opp.savingsImpact}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider block">Effort</span>
                              <span className="text-sm font-bold text-gray-900">{opp.effort}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Category Summary Panel */}
              {panelState === "category_summary" && (
                <motion.div
                  key="category"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Header */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">Showing</span>
                    <span className="text-sm font-semibold text-gray-900">Category Summary</span>
                    <span className="text-sm text-gray-700">for</span>
                    <span className="text-sm font-semibold text-gray-900">Vegetable Oil</span>
                    <span className="text-xs text-gray-400 ml-2">{getCurrentDate()}</span>
                  </div>

                  {/* Summary Card */}
                  <div className="bg-white rounded-2xl ring-1 ring-gray-100 overflow-hidden">
                    {/* Card Header */}
                    <div className="flex items-center justify-between p-5 border-b border-gray-100">
                      <h2 className="text-lg font-semibold text-gray-900">Vegetable Oil Category Summary</h2>
                      <div className="flex items-center gap-3">
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                        <button className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black">
                          Download
                        </button>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-5 space-y-6">
                      {/* Intro */}
                      <p className="text-sm text-gray-600 leading-relaxed">
                        New trade, supplier, and market data uploaded on October 16, 2025, have been processed. Max has recalibrated insights for the Vegetable Oils category, incorporating recent pricing, supplier compliance reports, and import/export updates.
                      </p>

                      {/* Sections */}
                      <div className="flex gap-8">
                        {/* Section Numbers */}
                        <div className="w-32 shrink-0 space-y-8">
                          <div>
                            <span className="text-2xl font-light text-gray-300">01</span>
                            <p className="text-sm font-medium text-gray-700 mt-1">Context Summary</p>
                          </div>
                          <div>
                            <span className="text-2xl font-light text-gray-300">02</span>
                            <p className="text-sm font-medium text-gray-700 mt-1">Category Overview</p>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 space-y-6">
                          {/* Metrics Grid */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 rounded-xl p-4">
                              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Current Category Health</span>
                              <p className="text-xl font-bold text-blue-500 mt-1">Moderate</p>
                              <span className="text-sm text-blue-500">$1.3M</span>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4">
                              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Spend Coverage</span>
                              <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-xl font-bold text-gray-900">92%</span>
                                <span className="text-sm text-gray-500">$1.3M</span>
                              </div>
                              <span className="text-xs text-red-500 flex items-center gap-1 mt-1">
                                <TrendingUp className="h-3 w-3" /> 4% since last update
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 rounded-xl p-4">
                              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Top Suppliers</span>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <span className="px-2 py-1 bg-white rounded text-xs text-gray-700 ring-1 ring-gray-200">PalmCo Asia</span>
                                <span className="px-2 py-1 bg-white rounded text-xs text-gray-700 ring-1 ring-gray-200">Solio Exports</span>
                                <span className="px-2 py-1 bg-white rounded text-xs text-gray-700 ring-1 ring-gray-200">AgroPure Ltd</span>
                              </div>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4">
                              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Key Materials</span>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <span className="px-2 py-1 bg-white rounded text-xs text-gray-700 ring-1 ring-gray-200">Palm oil</span>
                                <span className="px-2 py-1 bg-white rounded text-xs text-gray-700 ring-1 ring-gray-200">soybean oil</span>
                                <span className="px-2 py-1 bg-white rounded text-xs text-gray-700 ring-1 ring-gray-200">sunflower oil</span>
                              </div>
                            </div>
                          </div>

                          {/* Risk Info */}
                          <p className="text-sm text-gray-600 italic leading-relaxed">
                            Your category is stable overall, but there's emerging volatility in palm oil pricing due to new export restrictions in Malaysia. Supplier diversification is now more critical for maintaining savings projections.
                          </p>

                          {/* Risk Section */}
                          <div className="pt-4 border-t border-gray-100">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-2xl font-light text-gray-300">03</span>
                              <p className="text-sm font-medium text-gray-700">Risk & Compliance</p>
                            </div>
                            <p className="text-sm font-semibold text-gray-900 mb-3">Overall Category Risk: Elevated (↑)</p>
                            <ul className="space-y-2 text-sm text-gray-600">
                              <li><strong className="text-gray-900">Market Risk:</strong> High – driven by export levies and weather-related yield drops in Indonesia.</li>
                              <li><strong className="text-gray-900">Supplier Risk:</strong> Moderate – one supplier flagged for pending ESG re-certification.</li>
                              <li><strong className="text-gray-900">Financial Risk:</strong> Low – price stability maintained through long-term contracts.</li>
                            </ul>
                            <p className="text-sm text-gray-600 italic mt-4">
                              If the Malaysian levy increase persists beyond this quarter, projected category costs could rise by up to 9%. Consider pre-buying or diversifying into South American supply channels.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Top Opportunity Panel */}
              {panelState === "top_opportunity" && (
                <motion.div
                  key="opportunity"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Header */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">Showing</span>
                    <span className="text-sm font-semibold text-gray-900">top opportunity</span>
                    <span className="text-sm text-gray-700">for</span>
                    <span className="text-sm font-semibold text-gray-900">Vegetable Oils</span>
                    <span className="text-xs text-gray-400 ml-2">{getCurrentDate()}</span>
                  </div>

                  {/* Opportunity Card */}
                  <div className="bg-white rounded-2xl ring-1 ring-gray-100 overflow-hidden">
                    {/* Card Header */}
                    <div className="p-5 border-b border-gray-100">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 mt-1">
                            <CheckCircle2 className="h-5 w-5 text-teal-600" />
                          </div>
                          <div>
                            <h2 className="text-lg font-semibold text-gray-900 leading-tight">
                              Diversify Vegetable Oil Sourcing Beyond India to Capture Regional Savings and Flexibility
                            </h2>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-600 text-xs font-semibold rounded-full flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Qualified
                          </span>
                          <div className="flex items-center gap-1 text-gray-400">
                            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                              <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                            <span className="text-sm">3</span>
                          </div>
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 leading-relaxed mb-4">
                        Your current procurement strategy for vegetable oils shows a heavy reliance on Indian suppliers, accounting for over 90% of total spend. This limits sourcing flexibility and restricts the ability to capture competitive pricing and availability from nearby Southeast Asian markets such as Malaysia, Indonesia, and Thailand.
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <span className="text-sm text-gray-600">Very Popular</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-500">Confidence rating:</span>
                          <div className="flex gap-0.5">
                            {[1,2].map(i => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
                            {[3,4].map(i => <Star key={i} className="h-4 w-4 text-gray-300" />)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 border-b border-gray-100">
                      <div className="p-5 border-r border-gray-100">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Savings</span>
                        <p className="text-lg font-bold text-gray-900 mt-1">High</p>
                      </div>
                      <div className="p-5">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Effort</span>
                        <p className="text-lg font-bold text-gray-900 mt-1">0-3 months</p>
                      </div>
                    </div>

                    {/* Analysis & Rationale */}
                    <div className="p-5 border-b border-gray-100">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-900">Analysis & Rationale</h3>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Updated 5 Secs ago
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between py-2 border-b border-gray-50">
                          <span className="text-sm text-gray-600">Spend Concentration</span>
                          <span className="text-sm font-semibold text-gray-900">91% of total volume</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-50">
                          <span className="text-sm text-gray-600">Price Benchmark Gap</span>
                          <span className="text-sm font-semibold text-gray-900">6–9% higher than equivalent quality grades</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-50">
                          <span className="text-sm text-gray-600">Seasonal Opportunity</span>
                          <span className="text-sm font-semibold text-gray-900">8–12% during Q1 and Q3 due to export incentives</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-sm text-gray-600">Risk Profile</span>
                          <span className="text-sm font-semibold text-gray-900">Over-reliance on one geography increases vulnerability</span>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Sections */}
                    <div className="divide-y divide-gray-100">
                      <div className="p-5">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedOpportunity(!expandedOpportunity)}>
                          <div className="flex items-center gap-3">
                            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 16 16" fill="none">
                              <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                            <span className="text-sm font-semibold text-gray-900">What Did I find</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-blue-500">Updated 5 Secs ago</span>
                            <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${expandedOpportunity ? 'rotate-90' : ''}`} />
                          </div>
                        </div>
                        {expandedOpportunity && (
                          <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                            I analyzed your spending data across Office Supplies and identified that you're working with 5 suppliers in North America. Two of these suppliers—Global Tech Solutions and Pacific Office Group—have consistently delivered similar quality ratings.
                          </p>
                        )}
                      </div>

                      <div className="p-5">
                        <div className="flex items-center justify-between cursor-pointer">
                          <div className="flex items-center gap-3">
                            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 16 16" fill="none">
                              <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                              <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                            <span className="text-sm font-semibold text-gray-900">Why is this an opportunity?</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">5 Secs</span>
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Opportunity Rationale Panel */}
              {panelState === "opportunity_rationale" && (
                <motion.div
                  key="rationale"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Page Header */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">Showing</span>
                    <span className="text-sm font-semibold text-gray-900">opportunity rationale</span>
                    <span className="text-sm text-gray-700">for</span>
                    <span className="text-sm font-semibold text-gray-900">[opportunity name]</span>
                    <span className="text-xs text-gray-400 ml-2">{getCurrentDate()}</span>
                  </div>

                  {/* Header Card */}
                  <div className="bg-white rounded-2xl ring-1 ring-gray-100 overflow-hidden">
                    {/* Title Section */}
                    <div className="p-5 border-b border-gray-100">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 mt-1">
                            <CheckCircle2 className="h-5 w-5 text-teal-600" />
                          </div>
                          <div>
                            <h2 className="text-lg font-semibold text-gray-900 leading-tight pr-4">
                              Diversify Vegetable Oil Sourcing
                            </h2>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-600 text-xs font-semibold rounded-full flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Qualified
                          </span>
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                    </div>

                    {/* Metrics Row with Icons */}
                    <div className="flex items-center gap-6 p-4 border-b border-gray-100">
                      {/* Risk */}
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Risk:</span>
                        <span className="text-sm font-semibold text-emerald-600">Low</span>
                      </div>
                      {/* Savings */}
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 flex items-center justify-center">
                          <div className="h-3 w-3 border-2 border-gray-400 rounded" />
                        </div>
                        <span className="text-sm text-gray-600">Savings:</span>
                        <span className="text-sm font-semibold text-gray-900">$4.3M</span>
                      </div>
                      {/* Impact */}
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="2" y="6" width="3" height="8" rx="0.5" />
                          <rect x="6.5" y="3" width="3" height="11" rx="0.5" />
                          <rect x="11" y="1" width="3" height="13" rx="0.5" />
                        </svg>
                        <span className="text-sm text-gray-600">Impact:</span>
                        <span className="text-sm font-semibold text-blue-600">High</span>
                      </div>
                      {/* Urgency */}
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Urgency:</span>
                        <span className="text-sm font-semibold text-amber-600">Medium</span>
                      </div>
                    </div>

                    {/* Why is there a savings opportunity */}
                    <div className="p-5 border-b border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Why is there a savings opportunity</h3>
                      <p className="text-sm text-gray-600 leading-relaxed mb-6">
                        Diversifying sourcing origins to include competitive suppliers in Malaysia and Indonesia can capture pricing advantages and enhance supply resilience. Origin-switching strategies can capitalize on market dynamics and seasonal pricing patterns while maintaining quality standards.
                      </p>

                      {/* Spend concentration */}
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Spend concentration</h4>
                        <p className="text-sm text-gray-600">• Malaysia accounts for 81.4% of spend, India and Australia 7.1% each, Indonesia 4.5%.</p>
                      </div>

                      {/* Supplier base */}
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Supplier base</h4>
                        <p className="text-sm text-gray-600">• Total of 87 suppliers.</p>
                        <p className="text-sm text-gray-600">• Top supplier holds 8.6% share.</p>
                        <p className="text-sm text-gray-600">• HHI ≈ 344, indicating high fragmentation.</p>
                      </div>

                      {/* Key SKU */}
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Key SKU</h4>
                        <p className="text-sm text-gray-600">• Largest category is RAW Ricebran Oil with $43.99M spend, sourced from 37 suppliers across 1 plant.</p>
                      </div>

                      {/* Tariff exposure */}
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Tariff exposure</h4>
                        <p className="text-sm text-gray-600">• Landed cost for imported vegetable oils is highly sensitive to duty/cess shifts under HS 1512/1515 lines.</p>
                      </div>
                    </div>

                    {/* Pricing Trend Section */}
                    <div className="p-5">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4">Pricing Trend Comparison</h3>

                      {/* Chart Title */}
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-medium text-gray-700">Pricing Trend Comparison</h4>
                        <div className="flex items-center gap-4 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-0.5 bg-blue-500"></div>
                            <span className="text-gray-600">OECD-FAO</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-0.5 bg-orange-500"></div>
                            <span className="text-gray-600">Palm Oil Futures</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-0.5 bg-emerald-500"></div>
                            <span className="text-gray-600">South American S...</span>
                          </div>
                        </div>
                      </div>

                      {/* Chart */}
                      <div className="h-48 w-full relative">
                        <svg className="w-full h-full" viewBox="0 0 400 150" preserveAspectRatio="none">
                          {/* Grid lines */}
                          {[0, 1, 2, 3, 4].map(i => (
                            <line key={i} x1="40" y1={30 + i * 25} x2="390" y2={30 + i * 25} stroke="#f0f0f0" strokeWidth="1" />
                          ))}

                          {/* Y-axis labels */}
                          <text x="35" y="35" textAnchor="end" className="text-[8px] fill-gray-400">$1,400</text>
                          <text x="35" y="60" textAnchor="end" className="text-[8px] fill-gray-400">$1,200</text>
                          <text x="35" y="85" textAnchor="end" className="text-[8px] fill-gray-400">$1,000</text>
                          <text x="35" y="110" textAnchor="end" className="text-[8px] fill-gray-400">$800</text>
                          <text x="35" y="135" textAnchor="end" className="text-[8px] fill-gray-400">$600</text>

                          {/* X-axis labels */}
                          <text x="70" y="148" textAnchor="middle" className="text-[8px] fill-gray-400">Jan</text>
                          <text x="130" y="148" textAnchor="middle" className="text-[8px] fill-gray-400">Mar</text>
                          <text x="190" y="148" textAnchor="middle" className="text-[8px] fill-gray-400">May</text>
                          <text x="250" y="148" textAnchor="middle" className="text-[8px] fill-gray-400">Jul</text>
                          <text x="310" y="148" textAnchor="middle" className="text-[8px] fill-gray-400">Sep</text>
                          <text x="370" y="148" textAnchor="middle" className="text-[8px] fill-gray-400">Nov</text>

                          {/* OECD-FAO Line (Blue) */}
                          <path
                            d="M50 90 L90 85 L130 80 L170 75 L210 70 L250 72 L290 68 L330 65 L370 60"
                            fill="none"
                            stroke="#3B82F6"
                            strokeWidth="2"
                          />

                          {/* Palm Oil Futures Line (Orange) */}
                          <path
                            d="M50 70 L90 75 L130 65 L170 80 L210 85 L250 75 L290 90 L330 85 L370 95"
                            fill="none"
                            stroke="#F97316"
                            strokeWidth="2"
                          />

                          {/* South American Line (Green) */}
                          <path
                            d="M50 100 L90 95 L130 90 L170 85 L210 82 L250 78 L290 75 L330 70 L370 65"
                            fill="none"
                            stroke="#10B981"
                            strokeWidth="2"
                          />

                          {/* Data points */}
                          {[50, 90, 130, 170, 210, 250, 290, 330, 370].map((x, i) => (
                            <React.Fragment key={i}>
                              <circle cx={x} cy={[90, 85, 80, 75, 70, 72, 68, 65, 60][i]} r="3" fill="#3B82F6" />
                              <circle cx={x} cy={[70, 75, 65, 80, 85, 75, 90, 85, 95][i]} r="3" fill="#F97316" />
                              <circle cx={x} cy={[100, 95, 90, 85, 82, 78, 75, 70, 65][i]} r="3" fill="#10B981" />
                            </React.Fragment>
                          ))}
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Comparison Card */}
                  <div className="bg-white rounded-2xl ring-1 ring-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-900">Detailed Comparison</h3>
                        {/* Country Toggle */}
                        <div className="flex bg-gray-100 rounded-lg p-1">
                          <button
                            onClick={() => actions.updateSimulationSettings({ selectedCountry: "australia" })}
                            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                              selectedCountry === "australia"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                            }`}
                          >
                            Australia
                          </button>
                          <button
                            onClick={() => actions.updateSimulationSettings({ selectedCountry: "canada" })}
                            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                              selectedCountry === "canada"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                            }`}
                          >
                            Canada
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Comparison Table */}
                    <div className="p-5">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3">Cost Component</th>
                            <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3">India (Current)</th>
                            <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3">
                              {selectedCountry === "australia" ? "Australia" : "Canada"}
                            </th>
                            <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3">Difference</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          <tr>
                            <td className="py-3 text-sm text-gray-700">Base FOB Price</td>
                            <td className="py-3 text-sm text-gray-900 text-right font-medium">${costs.india.fob.toFixed(0)}/MT</td>
                            <td className="py-3 text-sm text-gray-900 text-right font-medium">${costs.comparison.fob.toFixed(0)}/MT</td>
                            <td className={`py-3 text-sm text-right font-medium ${costs.comparison.fob < costs.india.fob ? 'text-emerald-600' : 'text-red-600'}`}>
                              {costs.comparison.fob < costs.india.fob ? '-' : '+'}${Math.abs(costs.india.fob - costs.comparison.fob).toFixed(0)}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 text-sm text-gray-700">Ocean Freight</td>
                            <td className="py-3 text-sm text-gray-900 text-right font-medium">${costs.india.freight.toFixed(0)}/MT</td>
                            <td className="py-3 text-sm text-gray-900 text-right font-medium">${costs.comparison.freight.toFixed(0)}/MT</td>
                            <td className={`py-3 text-sm text-right font-medium ${costs.comparison.freight < costs.india.freight ? 'text-emerald-600' : 'text-red-600'}`}>
                              {costs.comparison.freight < costs.india.freight ? '-' : '+'}${Math.abs(costs.india.freight - costs.comparison.freight).toFixed(0)}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 text-sm text-gray-700">Taxes</td>
                            <td className="py-3 text-sm text-gray-900 text-right font-medium">${costs.india.taxes.toFixed(0)}/MT</td>
                            <td className="py-3 text-sm text-gray-900 text-right font-medium">${costs.comparison.taxes.toFixed(0)}/MT</td>
                            <td className={`py-3 text-sm text-right font-medium ${costs.comparison.taxes < costs.india.taxes ? 'text-emerald-600' : 'text-red-600'}`}>
                              {costs.comparison.taxes < costs.india.taxes ? '-' : '+'}${Math.abs(costs.india.taxes - costs.comparison.taxes).toFixed(0)}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 text-sm text-gray-700">Import Duty</td>
                            <td className="py-3 text-sm text-gray-900 text-right font-medium">${costs.india.duty.toFixed(0)}/MT</td>
                            <td className="py-3 text-sm text-gray-900 text-right font-medium">${costs.comparison.duty.toFixed(0)}/MT</td>
                            <td className={`py-3 text-sm text-right font-medium ${costs.comparison.duty < costs.india.duty ? 'text-emerald-600' : 'text-red-600'}`}>
                              {costs.comparison.duty < costs.india.duty ? '-' : '+'}${Math.abs(costs.india.duty - costs.comparison.duty).toFixed(0)}
                            </td>
                          </tr>
                          <tr className="border-t-2 border-gray-200">
                            <td className="py-3 text-sm font-semibold text-gray-900">Subtotal</td>
                            <td className="py-3 text-sm font-bold text-gray-900 text-right">${costs.india.total.toFixed(0)}/MT</td>
                            <td className="py-3 text-sm font-bold text-gray-900 text-right">${costs.comparisonTotal.toFixed(0)}/MT</td>
                            <td className={`py-3 text-sm font-bold text-right ${costs.savings > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              -${Math.abs(costs.savings).toFixed(0)} ({costs.savingsPct.toFixed(1)}%)
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Artifact Cards */}
                  <div className="space-y-3">
                    <div className="bg-white rounded-xl p-4 ring-1 ring-gray-100">
                      <div className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-3">
                          <svg className="h-5 w-5 text-gray-400" viewBox="0 0 16 16" fill="none">
                            <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                            <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                            <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                            <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                          <span className="text-sm font-semibold text-gray-900">What Did I find</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-blue-500">Updated 5 Secs ago</span>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-4 ring-1 ring-gray-100">
                      <div className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-3">
                          <svg className="h-5 w-5 text-gray-400" viewBox="0 0 16 16" fill="none">
                            <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                            <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                            <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                            <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                          <span className="text-sm font-semibold text-gray-900">Why is this an opportunity?</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">5 Secs</span>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPageWithSuspense() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <ChatPage />
    </Suspense>
  );
}
