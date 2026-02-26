"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  Folder,
  Trash2,
  Plus,
  X,
  Home,
  Activity,
  ShieldCheck,
  Search,
  User,
  LogOut,
  Loader2,
  Pencil,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp, type PortfolioItem } from "@/context/AppContext";
import { procurementApi, authApi } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";

// Comprehensive list of global locations (regions and countries)
const AVAILABLE_LOCATIONS = [
  // Regions
  "Europe",
  "North America",
  "South America",
  "Asia Pacific",
  "Middle East",
  "Africa",
  "Central America",
  "Caribbean",
  "Oceania",
  "Southeast Asia",
  "East Asia",
  "South Asia",
  "Central Asia",
  "Eastern Europe",
  "Western Europe",
  "Northern Europe",
  "Southern Europe",
  "Sub-Saharan Africa",
  "North Africa",
  "Latin America",
  "APAC",
  "EMEA",
  "LATAM",
  "ANZ",
  // Major Countries
  "United States",
  "Canada",
  "Mexico",
  "Brazil",
  "Argentina",
  "Chile",
  "Colombia",
  "Peru",
  "United Kingdom",
  "Germany",
  "France",
  "Italy",
  "Spain",
  "Netherlands",
  "Belgium",
  "Switzerland",
  "Austria",
  "Poland",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "Ireland",
  "Portugal",
  "Greece",
  "Czech Republic",
  "Romania",
  "Hungary",
  "Ukraine",
  "Russia",
  "Turkey",
  "China",
  "Japan",
  "South Korea",
  "India",
  "Indonesia",
  "Thailand",
  "Vietnam",
  "Malaysia",
  "Singapore",
  "Philippines",
  "Taiwan",
  "Hong Kong",
  "Bangladesh",
  "Pakistan",
  "Sri Lanka",
  "Australia",
  "New Zealand",
  "Saudi Arabia",
  "UAE",
  "United Arab Emirates",
  "Qatar",
  "Kuwait",
  "Israel",
  "Egypt",
  "South Africa",
  "Nigeria",
  "Kenya",
  "Morocco",
  "Ghana",
  "Ethiopia",
  "Tanzania",
  "Global",
  "Worldwide",
];

function PortfolioSetupContent() {
  const router = useRouter();
  const { state, actions } = useApp();
  const locationDropdownRef = useRef<HTMLDivElement>(null);

  // Use global state for portfolio items
  const portfolioItems = state.portfolioItems;
  const [isLoading, setIsLoading] = useState(!state.portfolioLoaded);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Track which categories are selected for analysis (multi-select)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());

  // Sub-category selection (stores the specific types user wants to analyze - now supports multiple)
  const [subCategories, setSubCategories] = useState<Record<string, string[]>>({});

  // Add/Edit Category Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PortfolioItem | null>(null);

  // Delete Confirmation State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<PortfolioItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    spend: "",
    locations: [] as string[],
    subCategories: [] as string[],
  });
  const [newSubCategory, setNewSubCategory] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [locationSearchResults, setLocationSearchResults] = useState<string[]>([]);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [highlightedLocationIndex, setHighlightedLocationIndex] = useState(0);

  // Close location dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target as Node)) {
        setIsLocationDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Helper to check if a string is a valid UUID (for API calls - demo data uses simple IDs like "1", "2")
  const isValidUUID = (id: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  };

  // Check if user is in demo mode (demo tokens start with "demo-token-")
  const isDemoMode = () => {
    if (typeof window === 'undefined') return true;
    const token = localStorage.getItem('beroe_auth_token');
    // No token = demo, or token starts with "demo-token-" = demo
    return !token || token.startsWith('demo-token-');
  };

  // Track if we've already fetched to prevent infinite loops
  const hasFetchedRef = useRef(false);

  // Fetch portfolio data on mount (only once)
  useEffect(() => {
    const fetchPortfolio = async () => {
      // Skip if already loaded from context OR if we've already fetched this session
      if (state.portfolioLoaded || hasFetchedRef.current) {
        setIsLoading(false);
        return;
      }

      // Mark as fetched to prevent re-fetching
      hasFetchedRef.current = true;

      // Check demo mode status
      const isDemo = isDemoMode();

      try {
        setIsLoading(true);
        setError(null);

        // Only call API if not in demo mode
        if (!isDemo) {
          const response = await procurementApi.getPortfolio();
          if (response.success && response.data && response.data.categories.length > 0) {
            actions.setPortfolioItems(response.data.categories);
            return;
          }
        }

        // Demo mode OR API returned empty for real user
        if (isDemo) {
          // Demo user: show sample data
          const defaultItems: PortfolioItem[] = [
            { id: "1", name: "Oils", locations: ["Europe", "India", "Asia Pacific"], spend: 50000000 },
            { id: "2", name: "Grains", locations: ["Europe", "North America"], spend: 25000000 },
          ];
          actions.setPortfolioItems(defaultItems);
        } else {
          // Real user with empty portfolio: show empty state
          actions.setPortfolioItems([]);
        }
      } catch (err) {
        console.error("Failed to fetch portfolio:", err);
        const isDemo = isDemoMode();
        if (isDemo) {
          // Demo mode: show sample data on error
          const defaultItems: PortfolioItem[] = [
            { id: "1", name: "Oils", locations: ["Europe", "India", "Asia Pacific"], spend: 50000000 },
            { id: "2", name: "Grains", locations: ["Europe", "North America"], spend: 25000000 },
          ];
          actions.setPortfolioItems(defaultItems);
        } else {
          // Real user: show empty state on error
          actions.setPortfolioItems([]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPortfolio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.portfolioLoaded]); // Only re-run when portfolioLoaded changes

  const handleContinue = async () => {
    // Get all selected categories with their sub-categories
    const selectedCategories = portfolioItems.filter(item => selectedCategoryIds.has(item.id));

    if (selectedCategories.length > 0) {
      // Calculate total spend across selected categories
      const totalSpend = selectedCategories.reduce((sum, cat) => sum + cat.spend, 0);

      // Flatten all sub-category names from all selected parent categories
      // These are what the user actually typed (e.g., ["Edible Oil", "Palm Oil", "Wheat"])
      const allSubCategoryNames: string[] = [];
      selectedCategories.forEach(c => {
        const subs = subCategories[c.id];
        if (subs && subs.length > 0) {
          allSubCategoryNames.push(...subs);
        } else {
          allSubCategoryNames.push(c.name); // fallback to parent name
        }
      });

      const categoryNames = allSubCategoryNames.join(", ");

      actions.updateSetupData({
        categoryName: categoryNames,
        spend: totalSpend,
      });

      // Store all sub-category names (specific types) for the analysis flow
      actions.setSelectedCategories(allSubCategoryNames);

      // Save portfolio/preferences to backend
      try {
        await authApi.updateSetup({
          setup_step: 1,
          preferences: {
            selectedCategories: allSubCategoryNames,
            parentCategories: selectedCategories.map(c => c.name),
            subCategories: subCategories,
            portfolioItems: selectedCategories,
            totalSpend: totalSpend,
          }
        });
        console.log("[Portfolio] Saved portfolio to backend");
      } catch (error) {
        console.warn("[Portfolio] Failed to save to backend:", error);
      }
    }
    actions.setSetupStep(1);
    router.push("/setup/goals");
  };

  // Handle category selection - toggle selection
  const handleSelectCategory = (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger card click (edit)

    if (selectedCategoryIds.has(categoryId)) {
      // Deselect - but keep sub-categories (they persist like locations)
      setSelectedCategoryIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(categoryId);
        return newSet;
      });
      // Don't clear sub-categories - they should persist like locations
    } else {
      // Select - use existing sub-categories if any
      setSelectedCategoryIds(prev => new Set([...prev, categoryId]));
    }
  };

  // Add a sub-category in the edit form
  const handleAddSubCategoryToForm = () => {
    const trimmed = newSubCategory.trim();
    if (trimmed && !categoryForm.subCategories.includes(trimmed)) {
      setCategoryForm(prev => ({
        ...prev,
        subCategories: [...prev.subCategories, trimmed]
      }));
      setNewSubCategory("");
    }
  };

  // Remove a sub-category from the edit form
  const handleRemoveSubCategoryFromForm = (subCat: string) => {
    setCategoryForm(prev => ({
      ...prev,
      subCategories: prev.subCategories.filter(s => s !== subCat)
    }));
  };

  // Open delete confirmation dialog
  const handleDeleteClick = (item: PortfolioItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setCategoryToDelete(item);
    setDeleteConfirmOpen(true);
  };

  // Confirm delete - instant UI update, API call in background
  const confirmDelete = () => {
    if (!categoryToDelete) return;

    const idToDelete = categoryToDelete.id;

    // Instantly update UI
    actions.removePortfolioItem(idToDelete);
    setCategoryToDelete(null);
    setDeleteConfirmOpen(false);

    // Only call API if it's a valid UUID (demo data uses simple IDs like "1", "2")
    if (isValidUUID(idToDelete)) {
      procurementApi.deleteCategory(idToDelete).catch(err => {
        console.error("Failed to delete category from API:", err);
      });
    }
  };

  // Cancel delete
  const cancelDelete = () => {
    setCategoryToDelete(null);
    setDeleteConfirmOpen(false);
  };

  const removeLocation = async (categoryId: string, location: string) => {
    // Only call API if it's a valid UUID
    if (isValidUUID(categoryId)) {
      try {
        await procurementApi.removeLocationFromCategory(categoryId, location);
      } catch (err) {
        console.error("Failed to remove location:", err);
      }
    }
    // Update global state
    const item = portfolioItems.find(i => i.id === categoryId);
    if (item) {
      actions.updatePortfolioItem({
        ...item,
        locations: item.locations.filter(loc => loc !== location)
      });
    }
  };

  // Open modal for adding new category
  const openAddModal = () => {
    setEditingCategory(null);
    setCategoryForm({ name: "", spend: "", locations: [], subCategories: [] });
    setNewLocation("");
    setNewSubCategory("");
    setIsModalOpen(true);
  };

  // Open modal for editing existing category
  const openEditModal = (item: PortfolioItem) => {
    setEditingCategory(item);
    setCategoryForm({
      name: item.name,
      spend: (item.spend / 1000000).toString(), // Convert to millions for display
      locations: [...item.locations],
      subCategories: subCategories[item.id] || [], // Load existing sub-categories
    });
    setNewLocation("");
    setNewSubCategory("");
    setIsModalOpen(true);
  };

  // Search locations based on input
  const handleLocationSearch = (query: string) => {
    setNewLocation(query);
    if (query.trim().length > 0) {
      const filtered = AVAILABLE_LOCATIONS.filter(
        loc =>
          loc.toLowerCase().includes(query.toLowerCase()) &&
          !categoryForm.locations.includes(loc)
      ).slice(0, 6); // Show max 6 results
      setLocationSearchResults(filtered);
      setIsLocationDropdownOpen(filtered.length > 0);
      setHighlightedLocationIndex(0); // Reset highlight when results change
    } else {
      setLocationSearchResults([]);
      setIsLocationDropdownOpen(false);
      setHighlightedLocationIndex(0);
    }
  };

  // Add location to form from search
  const handleSelectLocation = (location: string) => {
    if (!categoryForm.locations.includes(location)) {
      setCategoryForm(prev => ({
        ...prev,
        locations: [...prev.locations, location]
      }));
    }
    setNewLocation("");
    setLocationSearchResults([]);
    setIsLocationDropdownOpen(false);
  };

  // Add location to form (fallback for custom entry)
  const handleAddLocationToForm = () => {
    if (newLocation.trim()) {
      // Check if it matches any available location (case insensitive)
      const matchedLocation = AVAILABLE_LOCATIONS.find(
        loc => loc.toLowerCase() === newLocation.trim().toLowerCase()
      );

      const locationToAdd = matchedLocation || newLocation.trim();

      if (!categoryForm.locations.includes(locationToAdd)) {
        setCategoryForm(prev => ({
          ...prev,
          locations: [...prev.locations, locationToAdd]
        }));
      }
      setNewLocation("");
      setLocationSearchResults([]);
      setIsLocationDropdownOpen(false);
    }
  };

  // Remove location from form
  const handleRemoveLocationFromForm = (location: string) => {
    setCategoryForm(prev => ({
      ...prev,
      locations: prev.locations.filter(loc => loc !== location)
    }));
  };

  // Save category (add or update)
  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) return;

    setIsSaving(true);

    // Auto-add any pending sub-category text before saving
    let finalSubCategories = [...categoryForm.subCategories];
    if (newSubCategory.trim() && !finalSubCategories.includes(newSubCategory.trim())) {
      finalSubCategories.push(newSubCategory.trim());
    }

    // Use existing spend if editing, otherwise default to 0 (will be calculated from CSV later)
    const spendValue = categoryForm.spend ? parseFloat(categoryForm.spend) * 1000000 : (editingCategory?.spend || 0);

    try {
      if (editingCategory) {
        // Update existing category
        const updatedItem: PortfolioItem = {
          ...editingCategory,
          name: categoryForm.name.trim(),
          spend: spendValue,
          locations: categoryForm.locations,
        };

        // Only call API if it's a valid UUID (from backend, not local demo data)
        if (isValidUUID(editingCategory.id)) {
          try {
            await procurementApi.updateCategory(editingCategory.id, {
              name: updatedItem.name,
              spend: updatedItem.spend,
              locations: updatedItem.locations,
            });
          } catch (err) {
            console.error("Failed to update category in API:", err);
          }
        }

        // Update global state
        actions.updatePortfolioItem(updatedItem);

        // Save sub-categories
        if (finalSubCategories.length > 0) {
          setSubCategories(prev => ({
            ...prev,
            [editingCategory.id]: finalSubCategories
          }));
          // Auto-select if sub-categories were added
          setSelectedCategoryIds(prev => new Set([...prev, editingCategory.id]));
        } else {
          // Clear sub-categories if none specified
          setSubCategories(prev => {
            const newSubs = { ...prev };
            delete newSubs[editingCategory.id];
            return newSubs;
          });
        }
      } else {
        // Add new category with a local ID
        const newItem: PortfolioItem = {
          id: Date.now().toString(),
          name: categoryForm.name.trim(),
          spend: spendValue,
          locations: categoryForm.locations,
        };

        try {
          const response = await procurementApi.addCategory({
            name: newItem.name,
            spend: newItem.spend,
            locations: newItem.locations,
          });
          // Update with real ID from backend if successful
          if (response?.data?.id) {
            newItem.id = response.data.id;
          }
        } catch (err) {
          console.error("Failed to add category to API:", err);
        }

        // Add to global state
        actions.addPortfolioItem(newItem);

        // Save sub-categories for new item
        if (finalSubCategories.length > 0) {
          setSubCategories(prev => ({
            ...prev,
            [newItem.id]: finalSubCategories
          }));
          // Auto-select the new category if sub-categories were added
          setSelectedCategoryIds(prev => new Set([...prev, newItem.id]));
        }
      }

      // Reset and close
      handleCloseModal();
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseModal = () => {
    setEditingCategory(null);
    setCategoryForm({ name: "", spend: "", locations: [], subCategories: [] });
    setNewLocation("");
    setNewSubCategory("");
    setLocationSearchResults([]);
    setIsLocationDropdownOpen(false);
    setIsModalOpen(false);
  };

  const steps = [
    { name: "Confirm your portfolio", active: true, completed: false },
    { name: "Set your optimization goals", active: false, completed: false },
    { name: "Review your data", active: false, completed: false },
  ];

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-[#F0F9FF]">
      {/* Back Button */}
      <Link
        href="/setup"
        className="absolute top-6 left-6 z-20 flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-gray-600 hover:bg-white hover:text-gray-900 transition-colors shadow-sm ring-1 ring-gray-100"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

      {/* Background Decor */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-b from-[#B3D9FF]/40 via-[#F0F9FF] to-white" />

        {/* Yellow Building Detail - matching the perspective in the image */}
        <div className="absolute bottom-[-10%] left-[-5%] z-0 h-[50%] w-[60%] rotate-[-8deg] overflow-hidden border-t-[10px] border-white/50 bg-[#E5B800] shadow-2xl">
           <div className="absolute inset-0 flex flex-col space-y-6 pt-12">
             {Array.from({ length: 15 }).map((_, i) => (
               <div key={i} className="h-[1px] w-full bg-black/10" />
             ))}
           </div>
           {/* Windows/Structure detail */}
           <div className="absolute top-1/4 left-1/4 grid grid-cols-4 gap-4 opacity-20">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-20 w-12 bg-black/20 rounded-sm" />
              ))}
           </div>
        </div>
      </div>

      {/* Left Icon Sidebar */}
      <div className="relative z-20 flex w-16 flex-col items-center border-r border-gray-200/50 bg-white/20 py-8 backdrop-blur-md">
        <div className="mb-12 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
          <img src="/beroe cut.jpg" alt="Beroe" className="h-8 w-8 object-contain" />
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
          <Link href="/setup" className="flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-black">
            <ChevronLeft className="h-4 w-4" />
            Go Back
          </Link>

          <div className="flex items-center gap-3">
             <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
               {portfolioItems.length === 0 ? "Get Started" : "Your Portfolio"}
             </span>
             {portfolioItems.length > 0 && (
               <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">
                 {portfolioItems.length}
               </span>
             )}
             {selectedCategoryIds.size > 0 && (
               <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-semibold">
                 <Check className="h-3 w-3" />
                 {Object.values(subCategories).flat().filter(Boolean).join(", ") || `${selectedCategoryIds.size} selected`}
               </span>
             )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleContinue}
              disabled={selectedCategoryIds.size === 0}
              className="h-11 rounded-xl bg-[#1A1C1E] px-6 text-sm font-medium text-white transition-all hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {portfolioItems.length === 0
                ? "Add a category to continue"
                : selectedCategoryIds.size === 0
                  ? "Select categories"
                  : `Continue with ${selectedCategoryIds.size} ${selectedCategoryIds.size === 1 ? 'category' : 'categories'}`
              }
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[400px_1fr]">
          {/* Left Column */}
          <div className="space-y-12">
            <div className="space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Max</span>
              <h1 className="max-w-[320px] text-3xl font-medium leading-tight tracking-tight text-[#1A1C1E]">
                First, let's confirm what categories & geographies your portfolio includes.
              </h1>
              {/* Logo Small */}
              <div className="mt-4">
                <img src="/beroe cut.jpg" alt="Beroe" className="h-8 w-8 object-contain" />
              </div>
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
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${step.completed ? 'border-emerald-500 bg-emerald-500' : step.active ? 'border-black bg-black' : 'border-dashed border-gray-300'}`}>
                      {step.completed ? <Check className="h-3 w-3 text-white" /> : step.active && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <span className={`text-[14px] font-medium ${step.completed ? 'text-emerald-600' : 'text-[#1A1C1E]'}`}>{step.name}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-gray-100 p-6 pt-5">
                <div className="flex items-center justify-between mb-3">
                   <span className="text-[12px] font-semibold text-gray-400">0 of 3 complete</span>
                   <div className="h-1 w-8 rounded-full bg-gray-100">
                      <div className="h-full w-0 bg-blue-500 rounded-full" />
                   </div>
                </div>
                <div className="h-[4px] w-full rounded-full bg-gray-50">
                  <div className="h-full w-[0%] rounded-full bg-[#1A1C1E]" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Portfolio Cards */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Error Banner */}
            {error && (
              <div className="col-span-2 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700 flex items-center gap-2">
                <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}

            {isLoading ? (
              // Loading state
              <div className="col-span-2 flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : portfolioItems.length === 0 ? (
              // Empty state for new users - prominent Add Category card
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="col-span-2 flex flex-col items-center justify-center rounded-[48px] border-2 border-dashed border-blue-300/60 bg-gradient-to-br from-blue-50/50 to-white p-16 transition-all hover:border-blue-400 hover:shadow-lg group cursor-pointer"
                onClick={openAddModal}
              >
                <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-sky-50 text-blue-500 transition-transform group-hover:scale-110 shadow-lg shadow-blue-100">
                  <Plus className="h-14 w-14" />
                </div>
                <span className="text-3xl font-semibold text-[#1A1C1E] mb-3">Add Your First Category</span>
                <span className="text-[16px] text-gray-500 text-center max-w-md">
                  Start by adding a procurement category you want to analyze.
                  For example: Oils, Packaging, Raw Materials, etc.
                </span>
                <Button
                  className="mt-8 h-12 rounded-xl bg-[#1A1C1E] px-8 text-sm font-medium text-white transition-all hover:bg-black"
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Add Category
                </Button>
              </motion.div>
            ) : (
              <>
                {portfolioItems.map((item, idx) => {
                  const isSelected = selectedCategoryIds.has(item.id);
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => openEditModal(item)}
                      className={`group relative flex min-h-[340px] flex-col rounded-[48px] bg-white p-12 shadow-[0_15px_30px_rgba(0,0,0,0.03)] transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] cursor-pointer ${
                        isSelected
                          ? "ring-2 ring-emerald-500 ring-offset-2"
                          : "ring-1 ring-black/5"
                      }`}
                    >
                      {/* Selection Checkbox - Top Left */}
                      <button
                        onClick={(e) => handleSelectCategory(item.id, e)}
                        className={`absolute top-6 left-6 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all z-20 ${
                          isSelected
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "bg-white border-gray-300 hover:border-emerald-400 hover:bg-emerald-50"
                        }`}
                      >
                        {isSelected && <Check className="h-5 w-5" />}
                      </button>

                      <div className="flex items-center justify-between mb-10">
                         <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-50 transition-colors group-hover:bg-sky-100 ml-8">
                            <Folder className="h-8 w-8 text-sky-500" />
                         </div>
                         <button
                           className="text-gray-300 transition-colors hover:text-red-500 z-10"
                           onClick={(e) => handleDeleteClick(item, e)}
                         >
                            <Trash2 className="h-6 w-6" />
                         </button>
                      </div>

                      <h3 className={`text-3xl font-semibold text-[#1A1C1E] ${subCategories[item.id]?.length > 0 ? 'mb-1' : 'mb-6'}`}>{item.name}</h3>
                      {/* Show sub-categories (always visible like locations) */}
                      {subCategories[item.id]?.length > 0 && (
                        <div className="mb-5 flex flex-wrap gap-2">
                          {subCategories[item.id].map((subCat) => (
                            <span key={subCat} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${isSelected ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                              {isSelected && <Check className="h-3 w-3" />}
                              {subCat}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3 mb-8">
                        {item.locations.map((loc) => (
                          <Badge
                            key={loc}
                            variant="secondary"
                            className="rounded-xl bg-gray-50 px-5 py-3 text-[15px] font-medium text-[#4A4D55] border-none"
                          >
                            {loc}
                          </Badge>
                        ))}
                      </div>

                      <div className="mt-auto flex items-center justify-end">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100 transition-all group-hover:bg-blue-100 group-hover:text-blue-500">
                          <Pencil className="h-5 w-5" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Add Category Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  onClick={openAddModal}
                  className="flex min-h-[340px] cursor-pointer flex-col items-center justify-center rounded-[48px] border-2 border-dashed border-gray-200/60 bg-white/50 p-12 transition-all hover:border-blue-400/50 hover:bg-white/90 group"
                >
                   <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-sky-50 text-sky-500 transition-transform group-hover:scale-110">
                      <Plus className="h-12 w-12" />
                   </div>
                   <span className="text-2xl font-semibold text-[#1A1C1E]">Add a Category</span>
                   <span className="mt-4 text-[16px] text-gray-500">Create a new procurement category</span>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Category Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="sm:max-w-[480px] rounded-[24px] p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-gray-100">
            <DialogTitle className="text-xl font-semibold text-[#1A1C1E]">
              {editingCategory ? "Edit Category" : "Add a New Category"}
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-6">
            {/* Category Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Category Name</label>
              <Input
                placeholder="e.g., Oils, Grains"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                className="h-12 rounded-xl border-gray-200 focus:border-blue-400 focus:ring-blue-400"
              />
            </div>

            {/* Sub-Categories / Types */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">
                Category Types <span className="text-gray-400 font-normal">(specific types for analysis)</span>
              </label>

              {/* Add Sub-category Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., Edible Oil, Palm Oil, Wheat..."
                  value={newSubCategory}
                  onChange={(e) => setNewSubCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newSubCategory.trim()) {
                      e.preventDefault();
                      handleAddSubCategoryToForm();
                    }
                  }}
                  className="h-11 flex-1 rounded-xl border-gray-200 focus:border-emerald-400 focus:ring-emerald-400"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddSubCategoryToForm}
                  disabled={!newSubCategory.trim()}
                  className="h-11 px-4 rounded-xl border-gray-200"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[11px] text-gray-400">
                Type the specific category type and press Enter to add.
              </p>

              {/* Sub-category Tags - Below the input */}
              {categoryForm.subCategories.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {categoryForm.subCategories.map((subCat) => (
                    <Badge
                      key={subCat}
                      variant="secondary"
                      className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-[13px] font-medium text-emerald-700 border-none hover:bg-emerald-100 cursor-pointer"
                      onClick={() => handleRemoveSubCategoryFromForm(subCat)}
                    >
                      {subCat}
                      <X className="h-3 w-3 text-emerald-500" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Locations */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">
                Locations
              </label>

              {/* Add Location Input with Search */}
              <div className="relative" ref={locationDropdownRef}>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search locations (e.g., Europe, India, USA)"
                      value={newLocation}
                      onChange={(e) => handleLocationSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          if (locationSearchResults.length > 0) {
                            setHighlightedLocationIndex(prev =>
                              prev < locationSearchResults.length - 1 ? prev + 1 : 0
                            );
                          }
                        }
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          if (locationSearchResults.length > 0) {
                            setHighlightedLocationIndex(prev =>
                              prev > 0 ? prev - 1 : locationSearchResults.length - 1
                            );
                          }
                        }
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (locationSearchResults.length > 0) {
                            handleSelectLocation(locationSearchResults[highlightedLocationIndex]);
                          } else {
                            handleAddLocationToForm();
                          }
                        }
                        if (e.key === "Escape") {
                          setIsLocationDropdownOpen(false);
                        }
                      }}
                      onFocus={() => {
                        if (newLocation.trim() && locationSearchResults.length > 0) {
                          setIsLocationDropdownOpen(true);
                        }
                      }}
                      className="h-11 rounded-xl border-gray-200 pl-10 focus:border-blue-400 focus:ring-blue-400"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddLocationToForm}
                    disabled={!newLocation.trim()}
                    className="h-11 px-4 rounded-xl border-gray-200"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Location Search Dropdown */}
                {isLocationDropdownOpen && locationSearchResults.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                    {locationSearchResults.map((location, idx) => (
                      <button
                        key={location}
                        type="button"
                        onClick={() => handleSelectLocation(location)}
                        onMouseEnter={() => setHighlightedLocationIndex(idx)}
                        className={`w-full px-4 py-3 text-left text-[14px] transition-colors hover:bg-blue-50 flex items-center gap-3 ${
                          idx === highlightedLocationIndex ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full ${
                          idx === highlightedLocationIndex ? 'bg-blue-100' : 'bg-gray-100'
                        }`}>
                          <span className={`text-[10px] font-semibold ${
                            idx === highlightedLocationIndex ? 'text-blue-600' : 'text-gray-500'
                          }`}>
                            {location.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <span className={idx === highlightedLocationIndex ? 'text-blue-700 font-medium' : 'text-gray-700'}>{location}</span>
                        {idx === highlightedLocationIndex && (
                          <span className="ml-auto text-[11px] text-blue-500">↵ Enter</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Helper text */}
                <p className="mt-2 text-[11px] text-gray-400">
                  Search for regions or countries.
                </p>
              </div>

              {/* Location Badges - Below the input */}
              {categoryForm.locations.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {categoryForm.locations.map((loc) => (
                    <Badge
                      key={loc}
                      variant="secondary"
                      className="flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2.5 text-[13px] font-medium text-[#4A4D55] border-none hover:bg-gray-200 cursor-pointer"
                      onClick={() => handleRemoveLocationFromForm(loc)}
                    >
                      {loc}
                      <X className="h-3 w-3 text-gray-400" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 pt-4 border-t border-gray-100 flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={handleCloseModal}
              className="h-11 px-6 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCategory}
              disabled={!categoryForm.name.trim() || isSaving}
              className="h-11 px-6 rounded-xl bg-[#1A1C1E] text-white hover:bg-black"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                editingCategory ? "Save Changes" : "Add Category"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold text-[#1A1C1E]">
              Delete Category?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500">
              Are you sure you want to delete <span className="font-semibold text-gray-700">{categoryToDelete?.name}</span>?
              This action cannot be undone and all associated data including locations and analysis will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel
              onClick={cancelDelete}
              disabled={isDeleting}
              className="h-11 px-6 rounded-xl"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="h-11 px-6 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

export default function PortfolioSetupPage() {
  return (
    <ProtectedRoute>
      <PortfolioSetupContent />
    </ProtectedRoute>
  );
}
