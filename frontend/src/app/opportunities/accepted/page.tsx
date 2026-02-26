"use client";

import { motion } from "framer-motion";
import {
  ChevronDown,
  ArrowLeft,
  CheckCircle2,
  FileText,
  ChevronRight,
  Download,
  Loader2,
  MapPin,
  DollarSign,
  Target,
  TrendingUp,
  Shield,
  Package,
  AlertCircle
} from "lucide-react";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { procurementApi } from "@/lib/api/procurement";
import ProtectedRoute from "@/components/ProtectedRoute";
import Sidebar from "@/components/Sidebar";

// Opportunity type display names and icons
const OPPORTUNITY_CONFIG: Record<string, {
  title: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}> = {
  "volume-bundling": {
    title: "Volume Bundling",
    icon: <Package className="h-5 w-5" />,
    color: "text-blue-600",
    bgColor: "bg-blue-100"
  },
  "target-pricing": {
    title: "Target Pricing",
    icon: <Target className="h-5 w-5" />,
    color: "text-purple-600",
    bgColor: "bg-purple-100"
  },
  "risk-management": {
    title: "Risk Management",
    icon: <Shield className="h-5 w-5" />,
    color: "text-amber-600",
    bgColor: "bg-amber-100"
  },
  "respec-pack": {
    title: "Re-specification Pack",
    icon: <TrendingUp className="h-5 w-5" />,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100"
  }
};

export default function AcceptedOpportunityPage() {
  const { state } = useApp();
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Get accepted recommendations data from context
  const acceptedData = state.acceptedRecommendations;

  // Get opportunity config
  const oppConfig = acceptedData ? OPPORTUNITY_CONFIG[acceptedData.opportunityId] : null;

  // Format currency
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  };

  // Processing steps based on opportunity type
  const getProcessingSteps = () => {
    if (!acceptedData) return [];

    const validatedCount = acceptedData.proofPoints.filter(pp => pp.isValidated).length;
    const totalPPs = acceptedData.proofPoints.length;

    return [
      {
        icon: "document",
        title: `Analyzing ${acceptedData.categoryName} spend data`,
        result: formatCurrency(acceptedData.totalSpend),
      },
      {
        icon: "bullet",
        title: `Processing ${acceptedData.suppliers.length} supplier records`,
        result: `${acceptedData.suppliers.length} Suppliers`,
        indent: true
      },
      {
        icon: "document",
        title: `Validating proof points for ${oppConfig?.title || 'opportunity'}`,
        result: `${validatedCount}/${totalPPs} Validated`,
      },
      {
        icon: "bullet",
        title: `Compiling ${acceptedData.recommendations.length} accepted recommendations`,
        indent: true
      },
      {
        icon: "document",
        title: acceptedData.locations.length > 0
          ? `Adding regional context for ${acceptedData.locations.join(', ')}`
          : "Finalizing leadership brief",
        result: "Complete",
      }
    ];
  };

  const processingSteps = getProcessingSteps();

  // Simulate the generation process
  useEffect(() => {
    if (isGenerating && currentStep < processingSteps.length) {
      const timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, 600);
      return () => clearTimeout(timer);
    } else if (currentStep >= processingSteps.length && processingSteps.length > 0) {
      const timer = setTimeout(() => {
        setIsGenerating(false);
        setShowSummary(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isGenerating, currentStep, processingSteps.length]);

  // Handle download
  const handleDownload = async () => {
    if (!acceptedData) return;

    setIsDownloading(true);
    setDownloadError(null);

    try {
      // Calculate confidence score
      const validatedCount = acceptedData.proofPoints.filter(pp => pp.isValidated).length;
      const totalPPs = acceptedData.proofPoints.length;
      const confidenceScore = totalPPs > 0 ? (validatedCount / totalPPs) * 100 : 0;

      // Parse savings estimate to get low/high values
      // Use addressable spend (80% of total) for consistent calculations across the system
      const addressableSpend = acceptedData.totalSpend * 0.8;
      let savingsLow = addressableSpend * 0.03;
      let savingsHigh = addressableSpend * 0.08;
      if (acceptedData.savingsEstimate) {
        const match = acceptedData.savingsEstimate.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
        if (match) {
          savingsLow = addressableSpend * (parseFloat(match[1]) / 100);
          savingsHigh = addressableSpend * (parseFloat(match[2]) / 100);
        }
      }

      // Build spend by region data
      const spendByRegion = acceptedData.locations.length > 0
        ? acceptedData.locations.map((loc) => ({
            name: loc,
            spend: acceptedData.totalSpend / acceptedData.locations.length
          }))
        : [{ name: 'All Regions', spend: acceptedData.totalSpend }];

      // Ensure opportunity name has a fallback
      const opportunityName = acceptedData.opportunityName || oppConfig?.title || 'Opportunity';

      const response = await procurementApi.generateLeadershipBrief({
        opportunityId: acceptedData.opportunityId,
        opportunityName: opportunityName,
        categoryName: acceptedData.categoryName || 'Category',
        locations: acceptedData.locations || [],
        totalSpend: acceptedData.totalSpend || 0,
        recommendations: acceptedData.recommendations || [],
        proofPoints: acceptedData.proofPoints || [],
        suppliers: acceptedData.suppliers || [],
        metrics: acceptedData.metrics || {},
        savingsLow,
        savingsHigh,
        confidenceScore,
        spendByRegion
      });

      // Create download link
      const blob = new Blob([response], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
      const timeStr = now.toTimeString().slice(0, 5).replace(':', ''); // HHMM format
      a.download = `${acceptedData.categoryName.replace(/\s+/g, '_')}_${oppConfig?.title.replace(/\s+/g, '_') || 'Leadership'}_Brief_${dateStr}_${timeStr}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setDownloadError(`Failed to generate report: ${errorMessage}. Please ensure the backend is running.`);
    } finally {
      setIsDownloading(false);
    }
  };

  // If no accepted data, show message
  if (!acceptedData) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F0F7FF]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Accepted Recommendations</h2>
          <p className="text-gray-600 mb-4">Please select and accept recommendations from an opportunity first.</p>
          <Link href="/opportunities" className="text-blue-600 hover:text-blue-800 font-medium">
            Go to Opportunities
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
    <div className="relative flex h-screen w-full overflow-hidden bg-[#F0F7FF]">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-b from-[#E0F0FF]/60 via-[#F0F7FF] to-white" />
        <div className="absolute bottom-[-15%] left-[-5%] z-0 h-[60%] w-[50%] rotate-[-10deg] overflow-hidden border-t-[12px] border-white/40 bg-[#EAB308] shadow-2xl opacity-40">
          <div className="absolute inset-0 flex flex-col space-y-8 pt-16">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="h-[1px] w-full bg-black/5" />
            ))}
          </div>
        </div>
      </div>

      {/* Left Icon Sidebar */}
      <Sidebar user={state.user} />

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden relative z-10">

        {/* Left Column: Chat Interface */}
        <div className="flex w-[480px] flex-col border-r border-gray-100 bg-white">
          <header className="flex h-14 items-center gap-3 border-b border-gray-100 px-5">
            <Link href="/opportunities" className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft className="h-4 w-4 text-gray-600" />
            </Link>
            <div className="flex items-center gap-2 overflow-hidden flex-1">
              <h1 className="text-[14px] font-semibold text-gray-900">
                {oppConfig?.title || 'Opportunity'} - Accepted
              </h1>
              <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Assistant Header */}
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-purple-500">
                <span className="text-white font-bold text-xs">M</span>
              </div>
              <span className="text-[14px] font-semibold text-gray-900">Max AI</span>
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">just now</span>
            </div>

            {/* Assistant Message */}
            <p className="text-[14px] text-gray-700 leading-relaxed">
              I've accepted your <span className="font-semibold text-blue-600">{acceptedData.recommendations.length} recommendations</span> for {oppConfig?.title}.
              Let me prepare a leadership brief that summarizes the opportunity and next steps.
            </p>

            {/* AI Processing */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-blue-400 to-purple-400 p-[1px]">
                  <div className="h-full w-full rounded-full bg-white flex items-center justify-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-tr from-blue-400 to-purple-400" />
                  </div>
                </div>
                <span className="text-[14px] font-semibold text-gray-900">
                  {isGenerating ? "Preparing your leadership brief..." : "Leadership brief ready!"}
                </span>
              </div>

              {/* Processing Steps */}
              <div className="space-y-3 pl-2">
                {processingSteps.slice(0, currentStep).map((step, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-center gap-3 ${step.indent ? 'pl-6' : ''}`}
                  >
                    {step.icon === "document" ? (
                      <FileText className="h-4 w-4 text-gray-400" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                    )}
                    <span className="text-[13px] text-gray-600 flex-1">{step.title}</span>
                    {step.result && (
                      <div className="flex items-center gap-1 text-[12px] text-emerald-600 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{step.result}</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Summary Link - Show after processing */}
              {showSummary && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3 pt-4"
                >
                  <p className="text-[14px] text-gray-700">
                    Your leadership brief for <span className="font-semibold">{acceptedData.categoryName} - {oppConfig?.title}</span> is ready.
                    Click below to download.
                  </p>
                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100 hover:from-blue-100 hover:to-purple-100 transition-colors cursor-pointer group"
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${oppConfig?.bgColor || 'bg-blue-100'}`}>
                      {isDownloading ? (
                        <Loader2 className={`h-5 w-5 ${oppConfig?.color || 'text-blue-600'} animate-spin`} />
                      ) : (
                        oppConfig?.icon || <FileText className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <span className="text-[14px] font-semibold text-gray-900 block">
                        {oppConfig?.title} Leadership Brief
                      </span>
                      <span className="text-[12px] text-gray-500">
                        {acceptedData.categoryName} • {acceptedData.recommendations.length} recommendations
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-blue-600 group-hover:text-blue-800">
                        {isDownloading ? 'Generating...' : 'Download'}
                      </span>
                      {!isDownloading && <Download className="h-4 w-4 text-blue-600 group-hover:text-blue-800" />}
                    </div>
                  </button>
                  {downloadError && (
                    <p className="text-[12px] text-red-600 mt-2">{downloadError}</p>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Summary Document Preview */}
        <div className="flex-1 overflow-y-auto bg-[#F8FBFE]">
          {/* Breadcrumb */}
          <div className="sticky top-0 z-10 flex items-center gap-3 px-8 py-4 bg-[#F8FBFE]/80 backdrop-blur-sm border-b border-gray-100">
            <Link href="/opportunities" className="flex items-center gap-2 text-[13px] font-medium text-gray-500 hover:text-gray-700 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Opportunities
            </Link>
            <ChevronRight className="h-4 w-4 text-gray-300" />
            <div className={`flex items-center gap-2 text-[13px] font-medium ${oppConfig?.color || 'text-blue-600'}`}>
              <CheckCircle2 className="h-4 w-4" />
              {oppConfig?.title || 'Opportunity'} Accepted
            </div>
          </div>

          <div className="p-8 pb-32">
            {isGenerating && !showSummary ? (
              /* Loading State */
              <div className="flex flex-col items-center justify-center min-h-[400px]">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center"
                >
                  <div className={`h-16 w-16 rounded-2xl ${oppConfig?.bgColor || 'bg-blue-100'} flex items-center justify-center mx-auto mb-6`}>
                    <Loader2 className={`h-8 w-8 ${oppConfig?.color || 'text-blue-600'} animate-spin`} />
                  </div>
                  <p className="text-[16px] font-medium text-gray-700 mb-2">Generating Leadership Brief</p>
                  <p className="text-[14px] text-gray-500">{acceptedData.categoryName} - {oppConfig?.title}</p>
                </motion.div>
              </div>
            ) : showSummary && (
              /* Summary Document Preview */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto"
              >
                {/* Document Header */}
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`h-10 w-10 rounded-xl ${oppConfig?.bgColor || 'bg-blue-100'} flex items-center justify-center`}>
                        {oppConfig?.icon}
                      </div>
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${oppConfig?.color || 'text-blue-600'}`}>
                        Leadership Brief
                      </span>
                    </div>
                    <h1 className="text-[26px] font-bold text-gray-900 mb-2">
                      {acceptedData.categoryName}: {oppConfig?.title}
                    </h1>
                    <p className="text-[14px] text-gray-500">
                      Strategic Summary for Leadership Review • {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="h-10 px-5 rounded-xl bg-gray-900 text-[13px] font-semibold text-white flex items-center gap-2 hover:bg-black transition-colors disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {isDownloading ? 'Generating...' : 'Download .docx'}
                  </button>
                </div>

                {/* Executive Summary Section */}
                <div className="mb-10 border-t border-gray-100 pt-8">
                  <div className="grid grid-cols-12 gap-8">
                    <div className="col-span-3">
                      <span className="text-[32px] font-light text-gray-300">01</span>
                      <h2 className="text-[15px] font-semibold text-gray-900 mt-1">Executive<br />Summary</h2>
                    </div>
                    <div className="col-span-9 space-y-6">
                      <div>
                        <h3 className="text-[15px] font-bold text-gray-900 mb-2">{oppConfig?.title} Opportunity</h3>
                        <p className="text-[14px] text-gray-600 leading-relaxed">
                          Analysis of {acceptedData.categoryName} spend data ({formatCurrency(acceptedData.totalSpend)}) has identified
                          optimization opportunities with an estimated savings potential of {acceptedData.savingsEstimate}.
                          {acceptedData.locations.length > 0 && ` Focus regions: ${acceptedData.locations.join(', ')}.`}
                        </p>
                      </div>

                      {/* Metrics Cards */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="rounded-xl bg-[#F8FAFC] p-5 border border-gray-100">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-2">Total Spend</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-[28px] font-bold text-gray-900">{formatCurrency(acceptedData.totalSpend)}</span>
                          </div>
                        </div>
                        <div className="rounded-xl bg-[#F8FAFC] p-5 border border-gray-100">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-2">Est. Savings</span>
                          <span className="text-[28px] font-bold text-emerald-600">{acceptedData.savingsEstimate}</span>
                        </div>
                        <div className="rounded-xl bg-[#F8FAFC] p-5 border border-gray-100">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-2">Proof Points</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-[28px] font-bold text-gray-900">
                              {acceptedData.proofPoints.filter(pp => pp.isValidated).length}/{acceptedData.proofPoints.length}
                            </span>
                            <span className="text-[12px] font-medium text-gray-500">validated</span>
                          </div>
                        </div>
                      </div>

                      {/* Locations */}
                      {acceptedData.locations.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          {acceptedData.locations.map((loc, idx) => (
                            <span key={idx} className="text-[12px] font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                              {loc}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Key Suppliers Section */}
                <div className="mb-10 border-t border-gray-100 pt-8">
                  <div className="grid grid-cols-12 gap-8">
                    <div className="col-span-3">
                      <span className="text-[32px] font-light text-gray-300">02</span>
                      <h2 className="text-[15px] font-semibold text-gray-900 mt-1">Supplier<br />Analysis</h2>
                    </div>
                    <div className="col-span-9">
                      <div className="rounded-xl border border-gray-200 overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Supplier</th>
                              <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Spend</th>
                              <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">% of Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {acceptedData.suppliers.slice(0, 5).map((supplier, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-[13px] font-medium text-gray-900">{supplier.name}</td>
                                <td className="px-4 py-3 text-[13px] text-gray-600 text-right">{formatCurrency(supplier.spend)}</td>
                                <td className="px-4 py-3 text-[13px] text-gray-600 text-right">
                                  {acceptedData.totalSpend > 0 ? ((supplier.spend / acceptedData.totalSpend) * 100).toFixed(1) : 0}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {acceptedData.metrics.top3Concentration && (
                        <p className="text-[12px] text-gray-500 mt-3">
                          Top 3 supplier concentration: <span className="font-semibold text-gray-700">{acceptedData.metrics.top3Concentration.toFixed(0)}%</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Proof Points Section */}
                <div className="mb-10 border-t border-gray-100 pt-8">
                  <div className="grid grid-cols-12 gap-8">
                    <div className="col-span-3">
                      <span className="text-[32px] font-light text-gray-300">03</span>
                      <h2 className="text-[15px] font-semibold text-gray-900 mt-1">Proof<br />Points</h2>
                    </div>
                    <div className="col-span-9">
                      <div className="space-y-3">
                        {acceptedData.proofPoints.map((pp, idx) => (
                          <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg ${pp.isValidated ? 'bg-emerald-50 border border-emerald-100' : 'bg-gray-50 border border-gray-100'}`}>
                            <CheckCircle2 className={`h-5 w-5 ${pp.isValidated ? 'text-emerald-500' : 'text-gray-300'}`} />
                            <span className={`text-[13px] ${pp.isValidated ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                              {pp.name}
                            </span>
                            <span className={`ml-auto text-[11px] font-medium ${pp.isValidated ? 'text-emerald-600' : 'text-gray-400'}`}>
                              {pp.isValidated ? 'Validated' : 'Pending'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recommendations Section */}
                <div className="border-t border-gray-100 pt-8">
                  <div className="grid grid-cols-12 gap-8">
                    <div className="col-span-3">
                      <span className="text-[32px] font-light text-gray-300">04</span>
                      <h2 className="text-[15px] font-semibold text-gray-900 mt-1">Accepted<br />Recommendations</h2>
                    </div>
                    <div className="col-span-9 space-y-4">
                      {acceptedData.recommendations.map((rec, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${oppConfig?.bgColor || 'bg-blue-100'} mt-0.5`}>
                            <span className={`text-[11px] font-bold ${oppConfig?.color || 'text-blue-600'}`}>{idx + 1}</span>
                          </div>
                          <p className="text-[14px] text-gray-700 leading-relaxed flex-1">{rec.text}</p>
                          {/* Info icon that shows reason on hover */}
                          {rec.reason && (
                            <div className="group/tooltip relative shrink-0">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors cursor-help">
                                <AlertCircle className="h-3.5 w-3.5" />
                              </div>
                              {/* Tooltip */}
                              <div className="absolute right-0 bottom-full mb-2 w-80 z-[100] opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 pointer-events-none">
                                <div className="p-4 rounded-xl bg-gray-900 text-white shadow-2xl border border-gray-700">
                                  <p className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider mb-2">Why This Recommendation</p>
                                  <p className="text-[12px] text-gray-200 leading-relaxed">{rec.reason}</p>
                                  {/* Arrow pointing down */}
                                  <div className="absolute -bottom-2 right-4 w-4 h-4 bg-gray-900 rotate-45 border-r border-b border-gray-700" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}
