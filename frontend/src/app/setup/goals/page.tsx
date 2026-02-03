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
  Leaf,
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
    esg: number[];
  };
}

export default function GoalsSetupPage() {
  const router = useRouter();
  const { state, actions } = useApp();

  // Category-specific goals
  const [categoryGoals, setCategoryGoals] = React.useState<CategoryGoal[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = React.useState(false);
  const [initializedFromSelection, setInitializedFromSelection] = React.useState(false);

  // Get selected categories from context (set on portfolio page)
  const selectedCategories = state.selectedCategories || [];

  // Get portfolio items to get spend info
  const portfolioItems = state.portfolioItems || [];

  // Format spend for display
  const formatSpend = (spend: number): string => {
    if (spend >= 1000000) {
      return `$${(spend / 1000000).toFixed(1)}M`;
    } else if (spend >= 1000) {
      return `$${(spend / 1000).toFixed(0)}K`;
    }
    return `$${spend}`;
  };

  // Auto-initialize category goals from selected categories on mount
  React.useEffect(() => {
    if (!initializedFromSelection && selectedCategories.length > 0) {
      const initialGoals: CategoryGoal[] = selectedCategories.map((catName, idx) => {
        // Find the portfolio item to get spend info
        const portfolioItem = portfolioItems.find(
          item => item.name.toLowerCase() === catName.toLowerCase()
        );
        const spend = portfolioItem ? formatSpend(portfolioItem.spend) : "$0";

        return {
          id: `cat-${idx}-${Date.now()}`,
          name: catName,
          spend,
          goals: {
            cost: [34],
            risk: [33],
            esg: [33]
          }
        };
      });
      setCategoryGoals(initialGoals);
      setInitializedFromSelection(true);
    }
  }, [selectedCategories, portfolioItems, initializedFromSelection]);

  // Available categories from portfolio (for adding more manually)
  const availableCategories = portfolioItems
    .filter(item => !selectedCategories.includes(item.name))
    .map(item => ({
      name: item.name,
      spend: formatSpend(item.spend)
    }));

  // Total must always equal 100% - these represent percentage allocation of priorities
  // In procurement, you allocate focus across Cost Savings, Risk Management, and ESG
  const TOTAL_PERCENTAGE = 100;

  // Handle category-specific goal slider change - maintains exactly 100% total across all 3 goals
  // When one slider increases, the other two decrease proportionally
  const handleCategorySliderChange = (
    categoryId: string,
    changedGoal: 'cost' | 'risk' | 'esg',
    newValue: number[]
  ) => {
    setCategoryGoals(prev => prev.map(cat => {
      if (cat.id !== categoryId) return cat;

      const newVal = Math.max(0, Math.min(newValue[0], TOTAL_PERCENTAGE));
      const goalOrder: ('cost' | 'risk' | 'esg')[] = ['cost', 'risk', 'esg'];
      const otherGoals = goalOrder.filter(g => g !== changedGoal);

      const remaining = TOTAL_PERCENTAGE - newVal;
      const other1Current = cat.goals[otherGoals[0]][0];
      const other2Current = cat.goals[otherGoals[1]][0];
      const otherTotal = other1Current + other2Current;

      let newVal1: number;
      let newVal2: number;

      if (otherTotal === 0 || remaining === 0) {
        newVal1 = Math.floor(remaining / 2);
        newVal2 = remaining - newVal1;
      } else {
        const ratio1 = other1Current / otherTotal;
        newVal1 = Math.round(remaining * ratio1);
        newVal2 = remaining - newVal1;
      }

      return {
        ...cat,
        goals: {
          cost: [changedGoal === 'cost' ? newVal : (otherGoals[0] === 'cost' ? newVal1 : newVal2)],
          risk: [changedGoal === 'risk' ? newVal : (otherGoals[0] === 'risk' ? newVal1 : newVal2)],
          esg: [changedGoal === 'esg' ? newVal : (otherGoals[0] === 'esg' ? newVal1 : newVal2)]
        }
      };
    }));
  };

  // Add a new category-specific goal - starts with balanced 34/33/33 = 100%
  const addCategoryGoal = (categoryName: string, spend: string) => {
    const newGoal: CategoryGoal = {
      id: `cat-${Date.now()}`,
      name: categoryName,
      spend,
      goals: {
        cost: [34],
        risk: [33],
        esg: [33]
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

  // Sync goals to context in real-time for cross-page persistence
  // Use a ref to store actions to avoid including it in dependency array
  const actionsRef = React.useRef(actions);
  actionsRef.current = actions;

  // Sync category goals to context - use first category's goals or average across all
  React.useEffect(() => {
    if (categoryGoals.length > 0) {
      // Calculate average goals across all categories
      const avgCost = Math.round(categoryGoals.reduce((sum, cat) => sum + cat.goals.cost[0], 0) / categoryGoals.length);
      const avgRisk = Math.round(categoryGoals.reduce((sum, cat) => sum + cat.goals.risk[0], 0) / categoryGoals.length);
      const avgEsg = Math.round(categoryGoals.reduce((sum, cat) => sum + cat.goals.esg[0], 0) / categoryGoals.length);

      actionsRef.current.updateSetupData({
        goals: {
          cost: avgCost,
          risk: avgRisk,
          esg: avgEsg
        }
      });
    }
  }, [categoryGoals]);

  // Get category info from context
  const categoryName = state.setupData.categoryName || "All Categories";
  const categoryCount = state.portfolioItems.length || 3;

  const handleContinue = () => {
    // Calculate current goals from categoryGoals
    let finalCost = 34, finalRisk = 33, finalEsg = 33;

    if (categoryGoals.length > 0) {
      finalCost = Math.round(categoryGoals.reduce((sum, cat) => sum + cat.goals.cost[0], 0) / categoryGoals.length);
      finalRisk = Math.round(categoryGoals.reduce((sum, cat) => sum + cat.goals.risk[0], 0) / categoryGoals.length);
      finalEsg = Math.round(categoryGoals.reduce((sum, cat) => sum + cat.goals.esg[0], 0) / categoryGoals.length);
    }

    // Ensure goals are synced before navigation
    actions.updateSetupData({
      goals: {
        cost: finalCost,
        risk: finalRisk,
        esg: finalEsg
      }
    });

    // Record activity for setting goals
    const costLabel = finalCost >= 50 ? 'High' : finalCost >= 25 ? 'Medium' : 'Low';
    const riskLabel = finalRisk >= 50 ? 'High' : finalRisk >= 25 ? 'Medium' : 'Low';
    const esgLabel = finalEsg >= 50 ? 'High' : finalEsg >= 25 ? 'Medium' : 'Low';

    actions.addActivity({
      type: "goals",
      title: "Set optimization goals",
      description: `Configured goals: Cost ${costLabel}, Risk ${riskLabel}, ESG ${esgLabel}.`,
    });

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
             {selectedCategories.length > 0 && (
               <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-semibold">
                 <Check className="h-3 w-3" />
                 {selectedCategories.length} {selectedCategories.length === 1 ? 'category' : 'categories'}
               </span>
             )}
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

          {/* Right Column - Category Goal Cards Only */}
          <div className="flex flex-col gap-6 lg:flex-row lg:flex-wrap">
            {/* Category-Specific Goal Cards */}
            <AnimatePresence>
              {categoryGoals.map((catGoal, index) => {
                const IconComponent = categoryIcons[catGoal.name] || categoryIcons.default;
                const colors = categoryColors[catGoal.name] || categoryColors.default;

                return (
                  <motion.div
                    key={catGoal.id}
                    initial={{ opacity: 0, scale: 0.9, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: -20 }}
                    transition={{ delay: index * 0.1 }}
                    className="w-full max-w-[480px] rounded-[40px] bg-white p-10 shadow-[0_20px_60px_rgba(0,0,0,0.04)] ring-1 ring-black/5"
                  >
                    <div className="flex items-center gap-4 mb-8">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${colors.bg}`}>
                        <IconComponent className={`h-6 w-6 ${colors.text}`} />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-[#1A1C1E]">{catGoal.name}</h3>
                        <p className="mt-1 text-[13px] text-gray-400">These are the categories used to evaluate this goal. Adjust each slider to reflect its relative importance.</p>
                      </div>
                    </div>

                    <div className="space-y-16">
                      {/* Cost Savings */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CircleDollarSign className="h-5 w-5 text-gray-400" />
                            <span className="text-[15px] font-medium text-[#1A1C1E]">Cost Savings</span>
                          </div>
                          <span className={`text-[14px] font-semibold ${getLabel(catGoal.goals.cost[0]).color}`}>
                            {getLabel(catGoal.goals.cost[0]).text}
                          </span>
                        </div>
                        <Slider
                          value={catGoal.goals.cost}
                          onValueChange={(val) => handleCategorySliderChange(catGoal.id, 'cost', val)}
                          max={100}
                          step={1}
                          className="[&_[data-slot=slider-range]]:bg-indigo-500 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-thumb]]:h-6 [&_[data-slot=slider-thumb]]:w-6 [&_[data-slot=slider-thumb]]:border-[3px] [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:shadow-md"
                        />
                        <div className="flex items-center justify-between text-[12px] text-gray-400">
                          <span>Low</span>
                          <span>Medium</span>
                          <span>High</span>
                        </div>
                      </div>

                      {/* Risk Management */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ShieldAlert className="h-5 w-5 text-gray-400" />
                            <span className="text-[15px] font-medium text-[#1A1C1E]">Risk Management</span>
                          </div>
                          <span className={`text-[14px] font-semibold ${getLabel(catGoal.goals.risk[0]).color}`}>
                            {getLabel(catGoal.goals.risk[0]).text}
                          </span>
                        </div>
                        <Slider
                          value={catGoal.goals.risk}
                          onValueChange={(val) => handleCategorySliderChange(catGoal.id, 'risk', val)}
                          max={100}
                          step={1}
                          className="[&_[data-slot=slider-range]]:bg-indigo-500 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-thumb]]:h-6 [&_[data-slot=slider-thumb]]:w-6 [&_[data-slot=slider-thumb]]:border-[3px] [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:shadow-md"
                        />
                        <div className="flex items-center justify-between text-[12px] text-gray-400">
                          <span>Low</span>
                          <span>Medium</span>
                          <span>High</span>
                        </div>
                      </div>

                      {/* ESG */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Leaf className="h-5 w-5 text-gray-400" />
                            <span className="text-[15px] font-medium text-[#1A1C1E]">ESG</span>
                          </div>
                          <span className={`text-[14px] font-semibold ${getLabel(catGoal.goals.esg[0]).color}`}>
                            {getLabel(catGoal.goals.esg[0]).text}
                          </span>
                        </div>
                        <Slider
                          value={catGoal.goals.esg}
                          onValueChange={(val) => handleCategorySliderChange(catGoal.id, 'esg', val)}
                          max={100}
                          step={1}
                          className="[&_[data-slot=slider-range]]:bg-indigo-500 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-thumb]]:h-6 [&_[data-slot=slider-thumb]]:w-6 [&_[data-slot=slider-thumb]]:border-[3px] [&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:shadow-md"
                        />
                        <div className="flex items-center justify-between text-[12px] text-gray-400">
                          <span>Low</span>
                          <span>Medium</span>
                          <span>High</span>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="mt-8 pt-6 border-t border-gray-100">
                      <p className="text-[13px] text-gray-400">
                        Adjust Cost Savings, Risk Management, and ESG priorities to balance your procurement optimization strategy.
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Add Category Goal Cards - 2x2 Grid */}
            {remainingCategories.length > 0 && (
              <div className="grid grid-cols-2 gap-8 flex-1">
                {/* Show up to 4 Add Category Goal cards */}
                {[0, 1, 2, 3].map((index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (0.1 + index * 0.1) + categoryGoals.length * 0.1 }}
                    onClick={() => setShowCategoryPicker(true)}
                    className="flex min-h-[340px] w-full cursor-pointer flex-col items-center justify-center rounded-[48px] border-2 border-dashed border-gray-200/60 bg-white/50 p-12 transition-all hover:border-blue-400/50 hover:bg-white/90 group"
                  >
                    <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-sky-50 text-sky-500 transition-transform group-hover:scale-110">
                      <Plus className="h-12 w-12" />
                    </div>
                    <span className="text-center text-2xl font-semibold leading-tight text-[#1A1C1E]">Add Category Goal</span>
                    <span className="mt-4 text-[16px] text-gray-400">{remainingCategories.length} available</span>
                  </motion.div>
                ))}
              </div>
            )}
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
