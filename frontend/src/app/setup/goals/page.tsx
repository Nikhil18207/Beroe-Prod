"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ArrowRight,
  Folder,
  Plus,
  Home,
  Activity,
  ShieldCheck,
  Search,
  User,
  LogOut,
  Check,
  CircleDollarSign,
  ShieldAlert,
  Package,
  Truck,
  Wrench,
  Monitor,
  Users,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { useApp } from "@/context/AppContext";

// Category icon mapping
const categoryIcons: Record<string, React.ElementType> = {
  "Packaging": Package,
  "Logistics": Truck,
  "MRO": Wrench,
  "IT Services": Monitor,
  "HR Services": Users,
  "default": Folder
};

// Category colors
const categoryColors: Record<string, { bg: string; text: string }> = {
  "Packaging": { bg: "bg-orange-50", text: "text-orange-500" },
  "Logistics": { bg: "bg-green-50", text: "text-green-500" },
  "MRO": { bg: "bg-purple-50", text: "text-purple-500" },
  "IT Services": { bg: "bg-blue-50", text: "text-blue-500" },
  "HR Services": { bg: "bg-pink-50", text: "text-pink-500" },
  "default": { bg: "bg-sky-50", text: "text-sky-500" }
};

interface CategoryGoal {
  id: string;
  name: string;
  spend: string;
  goals: {
    cost: number[];
    risk: number[];
  };
}

export default function GoalsSetupPage() {
  const router = useRouter();
  const { state, actions } = useApp();

  const [goals, setGoals] = React.useState({
    cost: [state.setupData.goals.cost],
    risk: [state.setupData.goals.risk]
  });

  // Category-specific goals
  const [categoryGoals, setCategoryGoals] = React.useState<CategoryGoal[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = React.useState(false);

  // Available categories from portfolio (mock data - would come from context)
  const availableCategories = [
    { name: "Packaging", spend: "$2.5M" },
    { name: "Logistics", spend: "$1.8M" },
    { name: "MRO", spend: "$950K" },
    { name: "IT Services", spend: "$1.2M" },
    { name: "HR Services", spend: "$680K" },
  ];

  // Total must always equal 100% - these represent percentage allocation of priorities
  // In procurement, you allocate focus across Cost Savings and Risk Management
  const TOTAL_PERCENTAGE = 100;

  // Handle slider change - ALWAYS maintains exactly 100% total
  // Simple inverse relationship: when one goes up, the other goes down
  const handleSliderChange = (
    changedGoal: 'cost' | 'risk',
    newValue: number[]
  ) => {
    const newVal = Math.max(0, Math.min(newValue[0], TOTAL_PERCENTAGE));
    const otherGoal = changedGoal === 'cost' ? 'risk' : 'cost';

    setGoals({
      [changedGoal]: [newVal],
      [otherGoal]: [TOTAL_PERCENTAGE - newVal]
    } as typeof goals);
  };

  // Handle category-specific goal slider change - same inverse relationship
  const handleCategorySliderChange = (
    categoryId: string,
    changedGoal: 'cost' | 'risk',
    newValue: number[]
  ) => {
    setCategoryGoals(prev => prev.map(cat => {
      if (cat.id !== categoryId) return cat;

      const newVal = Math.max(0, Math.min(newValue[0], TOTAL_PERCENTAGE));
      const otherGoal = changedGoal === 'cost' ? 'risk' : 'cost';

      return {
        ...cat,
        goals: {
          [changedGoal]: [newVal],
          [otherGoal]: [TOTAL_PERCENTAGE - newVal]
        } as typeof cat.goals
      };
    }));
  };

  // Add a new category-specific goal - starts with balanced 50/50 = 100%
  const addCategoryGoal = (categoryName: string, spend: string) => {
    const newGoal: CategoryGoal = {
      id: `cat-${Date.now()}`,
      name: categoryName,
      spend,
      goals: {
        cost: [50],
        risk: [50]
      }
    };
    setCategoryGoals(prev => [...prev, newGoal]);
    setShowCategoryPicker(false);
  };

  // Remove a category-specific goal
  const removeCategoryGoal = (categoryId: string) => {
    setCategoryGoals(prev => prev.filter(cat => cat.id !== categoryId));
  };

  // Get categories not yet added
  const remainingCategories = availableCategories.filter(
    cat => !categoryGoals.some(cg => cg.name === cat.name)
  );

  // Calculate total for display - should always be 100%
  const totalPoints = goals.cost[0] + goals.risk[0];

  // Sync goals to context in real-time for cross-page persistence
  // Use a ref to store actions to avoid including it in dependency array
  const actionsRef = React.useRef(actions);
  actionsRef.current = actions;

  React.useEffect(() => {
    actionsRef.current.updateSetupData({
      goals: {
        cost: goals.cost[0],
        risk: goals.risk[0],
        esg: 0 // ESG removed from UI but keeping for API compatibility
      }
    });
  }, [goals.cost, goals.risk]);

  // Get category info from context
  const categoryName = state.setupData.categoryName || "All Categories";
  const categoryCount = state.portfolioItems.length || 3;

  const handleContinue = () => {
    actions.setSetupStep(2);
    router.push("/setup/review");
  };

  const getLabel = (val: number) => {
    if (val < 33) return { text: "Low", color: "text-amber-600" };
    if (val < 66) return { text: "Medium", color: "text-blue-600" };
    return { text: "High", color: "text-emerald-600" };
  };

  const steps = [
    { name: "Confirm your portfolio", completed: true, active: false },
    { name: "Set your optimization goals", completed: false, active: true },
    { name: "Review your data", completed: false, active: false },
  ];

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-[#F0F9FF]">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-b from-[#B3D9FF]/40 via-[#F0F9FF] to-white" />
        
        {/* Yellow Building Detail - Perspective matching image */}
        <div className="absolute bottom-[-10%] left-[-5%] z-0 h-[50%] w-[60%] rotate-[-8deg] overflow-hidden border-t-[10px] border-white/50 bg-[#E5B800] shadow-2xl">
           <div className="absolute inset-0 flex flex-col space-y-6 pt-12">
             {Array.from({ length: 15 }).map((_, i) => (
               <div key={i} className="h-[1px] w-full bg-black/10" />
             ))}
           </div>
           <div className="absolute top-1/4 left-1/4 grid grid-cols-4 gap-4 opacity-20">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-20 w-12 bg-black/20 rounded-sm" />
              ))}
           </div>
        </div>
      </div>

      {/* Left Icon Sidebar */}
      <div className="relative z-20 flex w-16 flex-col items-center border-r border-gray-200/50 bg-white/20 py-8 backdrop-blur-md">
        <div className="mb-12 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500" />
        </div>
        
        <div className="flex flex-col gap-8 text-gray-400">
           <Home className="h-6 w-6" />
           <Activity className="h-6 w-6 text-blue-600" />
           <ShieldCheck className="h-6 w-6" />
        </div>

        <div className="mt-auto flex flex-col gap-8 text-gray-400">
           <Search className="h-6 w-6" />
           <User className="h-6 w-6" />
           <LogOut className="h-6 w-6 text-red-400/60" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-1 flex-col p-8 lg:p-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-16">
          <Link href="/setup/portfolio" className="flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-black">
            <ChevronLeft className="h-4 w-4" />
            Go Back
          </Link>
          
          <div className="flex items-center gap-3">
             <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Your Optimization Goals</span>
          </div>

          <Button
            onClick={handleContinue}
            className="h-11 rounded-xl bg-[#1A1C1E] px-6 text-sm font-medium text-white transition-all hover:bg-black"
          >
            Apply & Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[400px_1fr]">
          {/* Left Column */}
          <div className="space-y-12">
            <div className="space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Max</span>
              <h1 className="max-w-[320px] text-3xl font-medium leading-tight tracking-tight text-[#1A1C1E]">
                Now let's talk about what goals serve you best.
              </h1>
              <p className="max-w-[320px] text-[14px] leading-relaxed text-gray-500">
                How would you rate the importance of these themes?
              </p>
            </div>

            {/* Checklist Card */}
            <div className="w-full max-w-[340px] overflow-hidden rounded-[32px] bg-white shadow-[0_20px_40px_rgba(0,0,0,0.04)] ring-1 ring-black/5">
              <div className="p-7 pb-4">
                <h2 className="text-[15px] font-semibold text-[#1A1C1E]">Complete your profile setup</h2>
              </div>
              
              <div className="space-y-1 p-2">
                {steps.map((step, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-4 rounded-2xl p-4 transition-colors ${step.active ? 'bg-gray-50' : step.completed ? 'bg-emerald-50/50' : 'opacity-60'}`}
                  >
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${step.completed ? 'border-emerald-500 bg-emerald-500' : step.active ? 'border-black bg-white' : 'border-dashed border-gray-300'}`}>
                      {step.completed ? <Check className="h-3 w-3 text-white" /> : step.active && <div className="h-1.5 w-1.5 rounded-full bg-black" />}
                    </div>
                    <span className={`text-[14px] font-medium ${step.completed ? 'text-emerald-600' : 'text-[#1A1C1E]'}`}>{step.name}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-gray-100 p-6 pt-5">
                <div className="flex items-center justify-between mb-3">
                   <span className="text-[12px] font-semibold text-gray-400">1 of 3 complete</span>
                </div>
                <div className="h-[4px] w-full rounded-full bg-gray-50">
                  <div className="h-full w-[33%] rounded-full bg-[#1A1C1E] transition-all duration-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Goal Sliders */}
          <div className="flex flex-col gap-6 lg:flex-row lg:flex-wrap">
            {/* Main Category Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-[480px] rounded-[40px] bg-white p-10 shadow-[0_20px_60px_rgba(0,0,0,0.04)] ring-1 ring-black/5"
            >
              <div className="flex items-center gap-4 mb-10">
                 <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50">
                    <Folder className="h-6 w-6 text-sky-500" />
                 </div>
                 <div>
                   <div className="flex items-center gap-2">
                     <h3 className="text-xl font-semibold text-[#1A1C1E]">{categoryName}</h3>
                     <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-[11px] font-bold text-white">{categoryCount}</span>
                   </div>
                   <p className="mt-1 text-[13px] text-gray-400">These are the categories used to evaluate this goal. Adjust each slider to reflect its relative importance.</p>
                 </div>
              </div>

              <div className="space-y-12">
                {/* Cost Savings */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <CircleDollarSign className="h-5 w-5 text-gray-400" />
                       <span className="text-[15px] font-medium text-[#1A1C1E]">Cost Savings</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] text-gray-400">{goals.cost[0]}%</span>
                      <span className={`text-[15px] font-semibold ${getLabel(goals.cost[0]).color}`}>{getLabel(goals.cost[0]).text}</span>
                    </div>
                  </div>
                  <Slider
                    value={goals.cost}
                    onValueChange={(val) => handleSliderChange('cost', val)}
                    max={100}
                    step={1}
                    className="[&_[data-slot=slider-range]]:bg-indigo-500 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-thumb]]:h-6 [&_[data-slot=slider-thumb]]:w-6 [&_[data-slot=slider-thumb]]:border-[3px] [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:shadow-md"
                  />
                  <div className="flex justify-between text-[14px] font-medium text-gray-400">
                    <span>Low</span>
                    <span>Medium</span>
                    <span>High</span>
                  </div>
                </div>

                {/* Risk Management */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <ShieldAlert className="h-5 w-5 text-gray-400" />
                       <span className="text-[15px] font-medium text-[#1A1C1E]">Risk Management</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] text-gray-400">{goals.risk[0]}%</span>
                      <span className={`text-[15px] font-semibold ${getLabel(goals.risk[0]).color}`}>{getLabel(goals.risk[0]).text}</span>
                    </div>
                  </div>
                  <Slider
                    value={goals.risk}
                    onValueChange={(val) => handleSliderChange('risk', val)}
                    max={100}
                    step={1}
                    className="[&_[data-slot=slider-range]]:bg-indigo-500 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-thumb]]:h-6 [&_[data-slot=slider-thumb]]:w-6 [&_[data-slot=slider-thumb]]:border-[3px] [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:shadow-md"
                  />
                  <div className="flex justify-between text-[14px] font-medium text-gray-400">
                    <span>Low</span>
                    <span>Medium</span>
                    <span>High</span>
                  </div>
                </div>

                {/* Info message and total */}
                <div className="mt-6 pt-8 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[16px] font-semibold text-gray-600">Total Allocation</span>
                    <span className="text-[18px] font-bold text-gray-800">{totalPoints}%</span>
                  </div>
                  <p className="text-[15px] text-gray-500">
                    Increasing Cost Savings reduces Risk tolerance, and vice versa.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Category-Specific Goal Cards */}
            <AnimatePresence>
              {categoryGoals.map((catGoal, index) => {
                const IconComponent = categoryIcons[catGoal.name] || categoryIcons.default;
                const colors = categoryColors[catGoal.name] || categoryColors.default;
                const catTotal = catGoal.goals.cost[0] + catGoal.goals.risk[0];

                return (
                  <motion.div
                    key={catGoal.id}
                    initial={{ opacity: 0, scale: 0.9, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: -20 }}
                    transition={{ delay: index * 0.1 }}
                    className="w-full max-w-[480px] rounded-[40px] bg-white p-10 shadow-[0_20px_60px_rgba(0,0,0,0.04)] ring-1 ring-black/5 relative"
                  >
                    {/* Remove button */}
                    <button
                      onClick={() => removeCategoryGoal(catGoal.id)}
                      className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 transition-colors group"
                    >
                      <X className="h-4 w-4 text-gray-400 group-hover:text-red-500" />
                    </button>

                    <div className="flex items-center gap-4 mb-10">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${colors.bg}`}>
                        <IconComponent className={`h-6 w-6 ${colors.text}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-semibold text-[#1A1C1E]">{catGoal.name}</h3>
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[11px] font-bold text-gray-600">{catGoal.spend}</span>
                        </div>
                        <p className="mt-1 text-[13px] text-gray-400">Category-specific optimization goals</p>
                      </div>
                    </div>

                    {/* Total Allocation for this category */}
                    <div className="mb-8 p-3 rounded-xl bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-gray-500">Total Allocation</span>
                        <span className="text-[11px] font-bold text-gray-600">{catTotal}%</span>
                      </div>
                    </div>

                    <div className="space-y-10">
                      {/* Cost Savings */}
                      <div className="space-y-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CircleDollarSign className="h-5 w-5 text-gray-400" />
                            <span className="text-[15px] font-medium text-[#1A1C1E]">Cost Savings</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[12px] text-gray-400">{catGoal.goals.cost[0]}%</span>
                            <span className={`text-[15px] font-semibold ${getLabel(catGoal.goals.cost[0]).color}`}>
                              {getLabel(catGoal.goals.cost[0]).text}
                            </span>
                          </div>
                        </div>
                        <Slider
                          value={catGoal.goals.cost}
                          onValueChange={(val) => handleCategorySliderChange(catGoal.id, 'cost', val)}
                          max={100}
                          step={1}
                          className="[&_[data-slot=slider-range]]:bg-indigo-500 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-thumb]]:h-6 [&_[data-slot=slider-thumb]]:w-6 [&_[data-slot=slider-thumb]]:border-[3px] [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:shadow-md"
                        />
                      </div>

                      {/* Risk Management */}
                      <div className="space-y-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ShieldAlert className="h-5 w-5 text-gray-400" />
                            <span className="text-[15px] font-medium text-[#1A1C1E]">Risk Management</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[12px] text-gray-400">{catGoal.goals.risk[0]}%</span>
                            <span className={`text-[15px] font-semibold ${getLabel(catGoal.goals.risk[0]).color}`}>
                              {getLabel(catGoal.goals.risk[0]).text}
                            </span>
                          </div>
                        </div>
                        <Slider
                          value={catGoal.goals.risk}
                          onValueChange={(val) => handleCategorySliderChange(catGoal.id, 'risk', val)}
                          max={100}
                          step={1}
                          className="[&_[data-slot=slider-range]]:bg-indigo-500 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-thumb]]:h-6 [&_[data-slot=slider-thumb]]:w-6 [&_[data-slot=slider-thumb]]:border-[3px] [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:shadow-md"
                        />
                      </div>

                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Add Category Goal Cards - 2x2 Grid */}
            <div className="grid grid-cols-2 gap-8 flex-1">
              {/* Card 1 - Clickable */}
              {remainingCategories.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + categoryGoals.length * 0.1 }}
                  onClick={() => setShowCategoryPicker(true)}
                  className="flex min-h-[340px] w-full cursor-pointer flex-col items-center justify-center rounded-[48px] border-2 border-dashed border-gray-200/60 bg-white/50 p-12 transition-all hover:border-blue-400/50 hover:bg-white/90 group"
                >
                  <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-sky-50 text-sky-500 transition-transform group-hover:scale-110">
                    <Plus className="h-12 w-12" />
                  </div>
                  <span className="text-center text-2xl font-semibold leading-tight text-[#1A1C1E]">Add Category Goal</span>
                  <span className="mt-4 text-[16px] text-gray-400">{remainingCategories.length} available</span>
                </motion.div>
              )}

              {/* Card 2 - Placeholder */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + categoryGoals.length * 0.1 }}
                className="flex min-h-[340px] w-full flex-col items-center justify-center rounded-[48px] border-2 border-dashed border-gray-100 bg-gray-50/30 p-12"
              >
                <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 text-gray-300">
                  <Plus className="h-12 w-12" />
                </div>
                <span className="text-center text-2xl font-medium leading-tight text-gray-300">Coming Soon</span>
                <span className="mt-4 text-[16px] text-gray-300">Market Insights</span>
              </motion.div>

              {/* Card 3 - Placeholder */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + categoryGoals.length * 0.1 }}
                className="flex min-h-[340px] w-full flex-col items-center justify-center rounded-[48px] border-2 border-dashed border-gray-100 bg-gray-50/30 p-12"
              >
                <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 text-gray-300">
                  <Plus className="h-12 w-12" />
                </div>
                <span className="text-center text-2xl font-medium leading-tight text-gray-300">Coming Soon</span>
                <span className="mt-4 text-[16px] text-gray-300">Supplier Analysis</span>
              </motion.div>

              {/* Card 4 - Placeholder */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + categoryGoals.length * 0.1 }}
                className="flex min-h-[340px] w-full flex-col items-center justify-center rounded-[48px] border-2 border-dashed border-gray-100 bg-gray-50/30 p-12"
              >
                <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 text-gray-300">
                  <Plus className="h-12 w-12" />
                </div>
                <span className="text-center text-2xl font-medium leading-tight text-gray-300">Coming Soon</span>
                <span className="mt-4 text-[16px] text-gray-300">Benchmarking</span>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Category Picker Modal */}
        <Dialog open={showCategoryPicker} onOpenChange={setShowCategoryPicker}>
          <DialogContent className="sm:max-w-[480px] rounded-3xl p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-4 border-b border-gray-100">
              <DialogTitle className="text-xl font-semibold">Select a Category</DialogTitle>
              <p className="text-[14px] text-gray-500 mt-1">Choose a category to set specific optimization goals</p>
            </DialogHeader>
            <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
              {remainingCategories.map((cat) => {
                const IconComponent = categoryIcons[cat.name] || categoryIcons.default;
                const colors = categoryColors[cat.name] || categoryColors.default;
                
                return (
                  <button
                    key={cat.name}
                    onClick={() => addCategoryGoal(cat.name, cat.spend)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-colors text-left group"
                  >
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${colors.bg} transition-transform group-hover:scale-105`}>
                      <IconComponent className={`h-6 w-6 ${colors.text}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-[15px] font-semibold text-[#1A1C1E]">{cat.name}</h4>
                      <p className="text-[13px] text-gray-400">Annual spend: {cat.spend}</p>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
