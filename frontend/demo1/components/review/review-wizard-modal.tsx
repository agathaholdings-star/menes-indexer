"use client";

import React from "react";
import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Check, Clock, Sparkles, Crown, Star, Heart, Smile, Flame, Leaf, Search, MapPin, AlertCircle } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { therapistTypes, bodyTypes, parameterLabels } from "@/lib/data";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

interface DBShop {
  id: number;
  name: string;
  display_name: string | null;
  access: string | null;
}

interface DBTherapist {
  id: number;
  name: string;
  image_urls: string[] | null;
  shop_id: number;
}

interface ReviewWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedTherapistId?: number | string;
  memberType?: "free" | "standard" | "vip";
  monthlyReviewCount?: number;
}

const TOTAL_STEPS = 9;

const typeIcons: Record<string, React.ElementType> = {
  idol: Sparkles,
  seiso: Heart,
  gal: Crown,
  model: Star,
  imouto: Smile,
  yoen: Flame,
};

// Prefecture short name → DB name mapping
const prefectureShortNames: Record<string, string> = {
  "東京": "東京都", "大阪": "大阪府", "京都": "京都府",
  "北海道": "北海道",
};

export function ReviewWizardModal({ open, onOpenChange, preselectedTherapistId, memberType = "free", monthlyReviewCount = 0 }: ReviewWizardModalProps) {
  const supabase = createSupabaseBrowser();
  const { user: authUser } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [showAllAreas, setShowAllAreas] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [shopSearch, setShopSearch] = useState("");
  const [therapistSearch, setTherapistSearch] = useState("");
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [selectedTherapistId, setSelectedTherapistId] = useState<number | null>(preselectedTherapistId || null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedBody, setSelectedBody] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [ratings, setRatings] = useState({
    conversation: 3,
    distance: 3,
    technique: 3,
    personality: 3,
  });
  const [score, setScore] = useState(80);
  const [reviewText, setReviewText] = useState({
    q1: "",
    q2: "",
    q3: "",
  });
  const [isComplete, setIsComplete] = useState(false);
  const [showMissingReport, setShowMissingReport] = useState(false);
  const [missingTherapistName, setMissingTherapistName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // DB state
  const [prefectures, setPrefectures] = useState<{ id: number; name: string }[]>([]);
  const [prefecturesWithShops, setPrefecturesWithShops] = useState<{ id: number; name: string; shop_count: number }[]>([]);
  const [dbShops, setDbShops] = useState<DBShop[]>([]);
  const [dbTherapists, setDbTherapists] = useState<DBTherapist[]>([]);
  const [directSearchMode, setDirectSearchMode] = useState(false);
  const [directShopSearch, setDirectShopSearch] = useState("");
  const [directSearchResults, setDirectSearchResults] = useState<DBShop[]>([]);
  const [shopStepSkipped, setShopStepSkipped] = useState(false);

  // Fetch prefectures on mount + which ones have shops
  useEffect(() => {
    if (!open) return;
    const fetchPrefectures = async () => {
      const { data } = await supabase.from("prefectures").select("id, name").order("id");
      if (data) setPrefectures(data);

      // Get prefectures that actually have shops
      const { data: shopPrefData } = await supabase.rpc("get_prefectures_with_shops");
      if (shopPrefData) {
        setPrefecturesWithShops(shopPrefData);
      } else {
        // Fallback: fetch manually
        const { data: allShopAreas } = await supabase
          .from("shop_areas")
          .select("area_id, areas(prefecture_id)");
        if (allShopAreas && data) {
          const prefCounts = new Map<number, number>();
          allShopAreas.forEach((sa: any) => {
            if (sa.areas?.prefecture_id) {
              prefCounts.set(sa.areas.prefecture_id, (prefCounts.get(sa.areas.prefecture_id) || 0) + 1);
            }
          });
          const withShops = data
            .filter(p => prefCounts.has(p.id))
            .map(p => ({ ...p, shop_count: prefCounts.get(p.id) || 0 }));
          setPrefecturesWithShops(withShops);
        }
      }
    };
    fetchPrefectures();
  }, [open]);

  // Direct shop search (across all shops)
  useEffect(() => {
    if (!directSearchMode || directShopSearch.length < 1) { setDirectSearchResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("shops")
        .select("id, name, display_name, access")
        .or(`display_name.ilike.%${directShopSearch}%,name.ilike.%${directShopSearch}%`)
        .limit(30);
      if (data) setDirectSearchResults(data);
    }, 300);
    return () => clearTimeout(timer);
  }, [directShopSearch, directSearchMode]);

  // Fetch shops when area (prefecture) selected
  useEffect(() => {
    if (!selectedArea) { setDbShops([]); return; }
    const fetchShops = async () => {
      // Match prefecture name: try exact, then with suffix, then partial
      const prefecture = prefectures.find(p => p.name === selectedArea)
        || prefectures.find(p => p.name === prefectureShortNames[selectedArea])
        || prefectures.find(p => p.name.startsWith(selectedArea));
      if (!prefecture) return;
      // Get area IDs for this prefecture, then shops via shop_areas
      const { data: areaData } = await supabase
        .from("areas")
        .select("id")
        .eq("prefecture_id", prefecture.id);
      if (!areaData || areaData.length === 0) { setDbShops([]); return; }
      const areaIds = areaData.map(a => a.id);
      const { data: shopAreaData } = await supabase
        .from("shop_areas")
        .select("shop_id, shops(id, name, display_name, access)")
        .in("area_id", areaIds);
      if (shopAreaData) {
        const shopMap = new Map<string, DBShop>();
        shopAreaData.forEach((sa: any) => {
          if (sa.shops && !shopMap.has(sa.shops.id)) {
            shopMap.set(sa.shops.id, {
              id: sa.shops.id,
              name: sa.shops.name,
              display_name: sa.shops.display_name,
              access: sa.shops.access,
            });
          }
        });
        setDbShops(Array.from(shopMap.values()));
      }
    };
    fetchShops();
  }, [selectedArea, prefectures]);

  // Fetch therapists when shop selected
  useEffect(() => {
    if (!selectedShopId) { setDbTherapists([]); return; }
    const fetchTherapists = async () => {
      const { data } = await supabase
        .from("therapists")
        .select("id, name, image_urls, shop_id")
        .eq("shop_id", selectedShopId)
        .order("name");
      if (data) setDbTherapists(data as unknown as DBTherapist[]);
    };
    fetchTherapists();
  }, [selectedShopId]);

  // Handle preselected therapist
  useEffect(() => {
    if (!preselectedTherapistId) return;
    const fetchPreselected = async () => {
      const { data } = await supabase
        .from("therapists")
        .select("id, name, shop_id")
        .eq("id", preselectedTherapistId)
        .single();
      if (data) {
        setSelectedTherapistId(data.id);
        setSelectedShopId(data.shop_id);
        setStep(3); // Skip to type selection
      }
    };
    fetchPreselected();
  }, [preselectedTherapistId]);

  // Filter shops by search (client-side on already-fetched data)
  const filteredShops = dbShops.filter(shop => {
    const displayName = shop.display_name || shop.name;
    return displayName.toLowerCase().includes(shopSearch.toLowerCase()) ||
      displayName.includes(shopSearch);
  });

  // Filter therapists by search (client-side on already-fetched data)
  const filteredTherapists = dbTherapists.filter(t =>
    t.name.toLowerCase().includes(therapistSearch.toLowerCase()) ||
    t.name.includes(therapistSearch)
  );

  // All prefecture names for area selector
  const allAreas = prefectures.map(p => p.name);

  const handleNext = async () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      // 最終ステップ: DBに口コミを保存
      if (!authUser) {
        // 未認証ユーザーはログインページへリダイレクト
        onOpenChange(false);
        router.push("/login?redirect=/review");
        return;
      }
      if (!selectedShopId || !selectedTherapistId) {
        return;
      }

      setSubmitting(true);
      try {
        // Find shop_id from the selected therapist's shop
        const shopId = selectedShopId;

        const { error } = await supabase.from("reviews").insert({
          user_id: authUser.id,
          therapist_id: selectedTherapistId,
          shop_id: shopId,
          looks_type: selectedType,
          body_type: selectedBody,
          service_level: selectedService,
          param_conversation: ratings.conversation,
          param_distance: ratings.distance,
          param_technique: ratings.technique,
          param_personality: ratings.personality,
          score: score,
          comment_first_impression: reviewText.q1,
          comment_service: reviewText.q2,
          comment_advice: reviewText.q3,
        });

        if (error) {
          console.error("Review insert failed:", error);
        }
      } catch (err) {
        console.error("Review submission error:", err);
      } finally {
        setSubmitting(false);
        setIsComplete(true);
      }
    }
  };

  const handleBack = () => {
    if (step > 0) {
      // 直接検索でstep 1をスキップした場合、step 2→step 0に戻る
      if (step === 2 && shopStepSkipped) {
        setShopStepSkipped(false);
        setSelectedShopId(null);
        setStep(0);
      } else {
        setStep(step - 1);
      }
    }
  };

  // Auto-advance when selection is made
  const handleAreaSelect = (area: string) => {
    setSelectedArea(area);
    setSelectedShopId(null);
    setSelectedTherapistId(null);
    setTimeout(() => setStep(1), 300);
  };

  const handleShopSelect = (shopId: number) => {
    setSelectedShopId(shopId);
    setSelectedTherapistId(null);
    setTimeout(() => setStep(2), 300);
  };

  const handleTherapistSelect = (therapistId: number) => {
    setSelectedTherapistId(therapistId);
    setTimeout(() => setStep(3), 300);
  };

  const handleTypeSelect = (typeId: string) => {
    setSelectedType(typeId);
    setTimeout(() => setStep(4), 300);
  };

  const handleBodySelect = (bodyId: string) => {
    setSelectedBody(bodyId);
    setTimeout(() => setStep(5), 300);
  };

  const handleServiceSelect = (serviceId: string) => {
    setSelectedService(serviceId);
    setTimeout(() => setStep(6), 300);
  };

  const handleClose = () => {
    setStep(0);
    setShowAllAreas(false);
    setSelectedArea(null);
    setShopSearch("");
    setTherapistSearch("");
    setSelectedShopId(null);
    setSelectedTherapistId(preselectedTherapistId || null);
    setSelectedType(null);
    setSelectedBody(null);
    setSelectedService(null);
    setRatings({ conversation: 3, distance: 3, technique: 3, personality: 3 });
    setScore(80);
    setReviewText({ q1: "", q2: "", q3: "" });
    setIsComplete(false);
    setShowMissingReport(false);
    setMissingTherapistName("");
    setShopStepSkipped(false);
    onOpenChange(false);
  };

  const canProceed = () => {
    switch (step) {
      case 0: return selectedArea !== null;
      case 1: return selectedShopId !== null;
      case 2: return selectedTherapistId !== null;
      case 3: return selectedType !== null;
      case 4: return selectedBody !== null;
      case 5: return selectedService !== null;
      case 6: return true; // Ratings are optional
      case 7: return true; // Score always has default
      case 8: return reviewText.q1.length >= 50 && reviewText.q2.length >= 100 && reviewText.q3.length >= 50;
      default: return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">
              {isComplete ? "投稿完了" : "口コミ投稿"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Progress Bar */}
        {!isComplete && (() => {
          const totalSteps = shopStepSkipped ? TOTAL_STEPS - 1 : TOTAL_STEPS;
          const currentStep = shopStepSkipped && step >= 2 ? step - 1 : step;
          return (
            <div className="flex gap-1 px-6 pt-4">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    i <= currentStep ? "bg-primary" : "bg-muted"
                  )}
                />
              ))}
            </div>
          );
        })()}

        {/* Step Content */}
        <div className="min-h-[400px] p-6">
          {isComplete ? (
            <CompletionScreen
              onClose={handleClose}
              onContinue={() => {
                setStep(0);
                setShowAllAreas(false);
                setSelectedArea(null);
                setShopSearch("");
                setTherapistSearch("");
                setSelectedShopId(null);
                setSelectedTherapistId(null);
                setSelectedType(null);
                setSelectedBody(null);
                setSelectedService(null);
                setRatings({ conversation: 3, distance: 3, technique: 3, personality: 3 });
                setScore(80);
                setReviewText({ q1: "", q2: "", q3: "" });
                setIsComplete(false);
                setShowMissingReport(false);
                setMissingTherapistName("");
                setShopStepSkipped(false);
                setDirectSearchMode(false);
                setDirectShopSearch("");
                setDirectSearchResults([]);
              }}
              memberType={memberType}
              monthlyReviewCount={monthlyReviewCount}
            />
          ) : (
            <>
              {step === 0 && (
                directSearchMode ? (
                  <StepDirectSearch
                    directShopSearch={directShopSearch}
                    setDirectShopSearch={setDirectShopSearch}
                    searchResults={directSearchResults}
                    onSelectShop={(shop) => {
                      setSelectedShopId(shop.id);
                      setDirectSearchMode(false);
                      setShopStepSkipped(true);
                      setTimeout(() => setStep(2), 300);
                    }}
                    onBack={() => setDirectSearchMode(false)}
                  />
                ) : (
                  <StepArea
                    selectedArea={selectedArea}
                    onSelect={handleAreaSelect}
                    showAllAreas={showAllAreas}
                    setShowAllAreas={setShowAllAreas}
                    allAreas={allAreas}
                    prefecturesWithShops={prefecturesWithShops}
                    onDirectSearch={() => setDirectSearchMode(true)}
                  />
                )
              )}
              {step === 1 && (
                <StepShop
                  shopSearch={shopSearch}
                  setShopSearch={setShopSearch}
                  selectedShopId={selectedShopId}
                  onSelect={handleShopSelect}
                  filteredShops={filteredShops}
                  selectedArea={selectedArea}
                />
              )}
              {step === 2 && (
                <StepTherapist
                  therapistSearch={therapistSearch}
                  setTherapistSearch={setTherapistSearch}
                  selectedTherapistId={selectedTherapistId}
                  onSelect={handleTherapistSelect}
                  filteredTherapists={filteredTherapists}
                  showMissingReport={showMissingReport}
                  setShowMissingReport={setShowMissingReport}
                  missingTherapistName={missingTherapistName}
                  setMissingTherapistName={setMissingTherapistName}
                />
              )}
              {step === 3 && (
                <StepType selectedType={selectedType} onSelect={handleTypeSelect} />
              )}
              {step === 4 && (
                <StepBody selectedBody={selectedBody} onSelect={handleBodySelect} />
              )}
              {step === 5 && (
                <StepService selectedService={selectedService} onSelect={handleServiceSelect} />
              )}
              {step === 6 && (
                <StepRatings
                  ratings={ratings}
                  onChangeRating={(key, value) => setRatings(prev => ({ ...prev, [key]: value }))}
                />
              )}
              {step === 7 && (
                <StepScore score={score} onChangeScore={setScore} />
              )}
              {step === 8 && (
                <StepText
                  reviewText={reviewText}
                  onChange={(key, value) => setReviewText(prev => ({ ...prev, [key]: value }))}
                />
              )}
            </>
          )}
        </div>

        {/* Navigation */}
        {!isComplete && (
          <div className="flex items-center justify-between p-6 pt-0 border-t mt-4">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={step === 0}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              戻る
            </Button>
            <span className="text-sm text-muted-foreground">
              {(shopStepSkipped && step >= 2 ? step : step + 1)} / {shopStepSkipped ? TOTAL_STEPS - 1 : TOTAL_STEPS}
            </span>
            <Button onClick={handleNext} disabled={!canProceed() || submitting} className="gap-1">
              {submitting ? "投稿中..." : step === TOTAL_STEPS - 1 ? "投稿する" : "次へ"}
              {step < TOTAL_STEPS - 1 && !submitting && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Step 0: Area Selection
function StepArea({
  selectedArea,
  onSelect,
  showAllAreas,
  setShowAllAreas,
  allAreas,
  prefecturesWithShops,
  onDirectSearch,
}: {
  selectedArea: string | null;
  onSelect: (area: string) => void;
  showAllAreas: boolean;
  setShowAllAreas: (v: boolean) => void;
  allAreas: string[];
  prefecturesWithShops: { id: number; name: string; shop_count: number }[];
  onDirectSearch: () => void;
}) {
  // Show prefectures with shops first, then all
  const topAreas = prefecturesWithShops.slice(0, 8);
  const displayAreas = showAllAreas ? allAreas : topAreas.map(p => p.name);
  const shopCounts = new Map(prefecturesWithShops.map(p => [p.name, p.shop_count]));

  return (
    <div>
      <h3 className="text-base font-semibold mb-1">エリアを選択</h3>
      <p className="text-sm text-muted-foreground mb-4">
        メンズエステのあるエリアを選んでください
      </p>

      {/* Direct search shortcut */}
      <button
        type="button"
        onClick={onDirectSearch}
        className="w-full mb-4 flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed hover:bg-muted/50 transition-colors"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">店舗名で直接検索</span>
      </button>

      <div className="grid grid-cols-2 gap-3">
        {displayAreas.map((area) => (
          <button
            key={area}
            type="button"
            onClick={() => onSelect(area)}
            className={cn(
              "flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all",
              selectedArea === area
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            <MapPin className="h-5 w-5 text-primary" />
            <div className="text-left">
              <span className="font-medium">{area}</span>
              {shopCounts.has(area) && (
                <span className="text-xs text-muted-foreground ml-1">({shopCounts.get(area)})</span>
              )}
            </div>
          </button>
        ))}
      </div>
      {!showAllAreas && (
        <button
          type="button"
          onClick={() => setShowAllAreas(true)}
          className="w-full mt-4 text-sm text-primary hover:underline"
        >
          他のエリアを表示（{allAreas.length}都道府県）
        </button>
      )}
      {displayAreas.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          店舗データを準備中です。「店舗名で直接検索」をお試しください。
        </p>
      )}
    </div>
  );
}

// Direct Shop Search (skip prefecture selection)
function StepDirectSearch({
  directShopSearch,
  setDirectShopSearch,
  searchResults,
  onSelectShop,
  onBack,
}: {
  directShopSearch: string;
  setDirectShopSearch: (v: string) => void;
  searchResults: DBShop[];
  onSelectShop: (shop: DBShop) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="text-base font-semibold">店舗名で検索</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        店舗名の一部を入力してください
      </p>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="例: アロマ、リラク、スパ..."
          value={directShopSearch}
          onChange={(e) => setDirectShopSearch(e.target.value)}
          className="pl-10"
          autoFocus
        />
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {directShopSearch.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">店舗名を入力すると候補が表示されます</p>
        )}
        {directShopSearch.length > 0 && searchResults.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">該当する店舗が見つかりません</p>
        )}
        {searchResults.map(shop => (
          <button
            key={shop.id}
            type="button"
            onClick={() => onSelectShop(shop)}
            className="w-full text-left px-4 py-3 rounded-lg transition-colors hover:bg-muted border flex items-center justify-between"
          >
            <div>
              <span className="font-medium">{shop.display_name || shop.name}</span>
              {shop.access && (
                <p className="text-xs text-muted-foreground mt-0.5">{shop.access}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Step 1: Shop Selection
function StepShop({
  shopSearch,
  setShopSearch,
  selectedShopId,
  onSelect,
  filteredShops,
  selectedArea,
}: {
  shopSearch: string;
  setShopSearch: (v: string) => void;
  selectedShopId: number | null;
  onSelect: (shopId: number) => void;
  filteredShops: DBShop[];
  selectedArea: string | null;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold mb-1">{selectedArea}のサロンを選択</h3>
      <p className="text-sm text-muted-foreground mb-4">
        ひらがな・カタカナで検索できます
      </p>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="店舗名で検索"
          value={shopSearch}
          onChange={(e) => setShopSearch(e.target.value)}
          className="pl-10"
        />
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {filteredShops.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">サロンが見つかりません</p>
        )}
        {filteredShops.map(shop => (
          <button
            key={shop.id}
            type="button"
            onClick={() => onSelect(shop.id)}
            className={cn(
              "w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center justify-between",
              selectedShopId === shop.id
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted border"
            )}
          >
            <span className="font-medium">{shop.display_name || shop.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Step 2: Therapist Selection with Images
function StepTherapist({
  therapistSearch,
  setTherapistSearch,
  selectedTherapistId,
  onSelect,
  filteredTherapists,
  showMissingReport,
  setShowMissingReport,
  missingTherapistName,
  setMissingTherapistName,
}: {
  therapistSearch: string;
  setTherapistSearch: (v: string) => void;
  selectedTherapistId: number | null;
  onSelect: (therapistId: number) => void;
  filteredTherapists: DBTherapist[];
  showMissingReport: boolean;
  setShowMissingReport: (v: boolean) => void;
  missingTherapistName: string;
  setMissingTherapistName: (v: string) => void;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold mb-1">セラピストを選択</h3>
      <p className="text-sm text-muted-foreground mb-4">
        名前で検索、または一覧から選択
      </p>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="セラピスト名で検索"
          value={therapistSearch}
          onChange={(e) => setTherapistSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredTherapists.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">セラピストが見つかりません</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-2">【50音順】</p>
          <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {filteredTherapists.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t.id)}
                className={cn(
                  "relative rounded-lg overflow-hidden transition-all aspect-[3/4]",
                  selectedTherapistId === t.id
                    ? "ring-2 ring-primary ring-offset-2"
                    : "hover:opacity-80"
                )}
              >
                {t.image_urls && t.image_urls.length > 0 ? (
                  <Image
                    src={t.image_urls[0]}
                    alt={t.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <span className="text-2xl font-bold text-muted-foreground">{t.name.charAt(0)}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-1.5 text-white">
                  <p className="text-xs font-medium truncate">{t.name}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Missing therapist report */}
      <div className="mt-4 pt-4 border-t">
        {!showMissingReport ? (
          <button
            type="button"
            onClick={() => setShowMissingReport(true)}
            className="w-full text-left px-4 py-3 rounded-lg text-sm text-primary hover:bg-muted border border-dashed flex items-center gap-2"
          >
            <AlertCircle className="h-4 w-4" />
            この人がいない（運営に報告）
          </button>
        ) : (
          <div className="p-4 rounded-lg border bg-muted/50 space-y-3">
            <p className="text-sm font-medium">セラピストが見つからない場合</p>
            <p className="text-xs text-muted-foreground">
              セラピスト名をご記入ください。運営が確認後、正規ルートで追加します。追加後にお知らせします。
            </p>
            <Input
              placeholder="セラピスト名"
              value={missingTherapistName}
              onChange={(e) => setMissingTherapistName(e.target.value)}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowMissingReport(false)} className="bg-transparent">
                キャンセル
              </Button>
              <Button size="sm" disabled={!missingTherapistName.trim()}>
                報告する
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Step 3: Type Selection
function StepType({
  selectedType,
  onSelect,
}: {
  selectedType: string | null;
  onSelect: (type: string) => void;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold mb-1">この子のタイプは？</h3>
      <p className="text-sm text-muted-foreground mb-4">
        最も当てはまるタイプを1つ選んでください
      </p>
      <div className="grid grid-cols-2 gap-3">
        {therapistTypes.map((type) => {
          const Icon = typeIcons[type.id] || Sparkles;
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => onSelect(type.id)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                selectedType === type.id
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <Icon className="h-8 w-8 text-primary" />
              <span className="font-medium text-sm">{type.label}</span>
              <span className="text-xs text-muted-foreground">{type.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Step 4: Body Type Selection
function StepBody({
  selectedBody,
  onSelect,
}: {
  selectedBody: string | null;
  onSelect: (body: string) => void;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold mb-1">ボディタイプは？</h3>
      <p className="text-sm text-muted-foreground mb-4">
        最も近いものを1つ選んでください
      </p>
      <div className="grid grid-cols-2 gap-3">
        {bodyTypes.map((bt) => (
          <button
            key={bt.id}
            type="button"
            onClick={() => onSelect(bt.id)}
            className={cn(
              "flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all",
              selectedBody === bt.id
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            <span className="font-medium text-sm">{bt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Step 5: Service Selection - 3 choices
function StepService({
  selectedService,
  onSelect,
}: {
  selectedService: string | null;
  onSelect: (service: string) => void;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold mb-1">どこまでいけた？</h3>
      <p className="text-sm text-muted-foreground mb-4">
        最も近いものを1つ選んでください
      </p>
      <div className="grid grid-cols-1 gap-3">
        {/* 健全 */}
        <button
          type="button"
          onClick={() => onSelect("kenzen")}
          className={cn(
            "flex items-center gap-4 p-4 rounded-xl border-2 transition-all",
            selectedService === "kenzen"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          )}
        >
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <Leaf className="h-6 w-6 text-green-600" />
          </div>
          <div className="text-left">
            <span className="font-medium">健全</span>
            <p className="text-xs text-muted-foreground">マッサージ重視</p>
          </div>
        </button>

        {/* SKR */}
        <button
          type="button"
          onClick={() => onSelect("skr")}
          className={cn(
            "flex items-center gap-4 p-4 rounded-xl border-2 transition-all",
            selectedService === "skr"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          )}
        >
          <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-2xl">
            🍄
          </div>
          <div className="text-left">
            <span className="font-medium">SKR</span>
            <p className="text-xs text-muted-foreground">きのこ</p>
          </div>
        </button>

        {/* HR */}
        <button
          type="button"
          onClick={() => onSelect("hr")}
          className={cn(
            "flex items-center gap-4 p-4 rounded-xl border-2 transition-all",
            selectedService === "hr"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          )}
        >
          <div className="h-12 w-12 rounded-full bg-pink-100 flex items-center justify-center">
            <Heart className="h-6 w-6 text-pink-500 fill-pink-500" />
          </div>
          <div className="text-left">
            <span className="font-medium">HR</span>
            <p className="text-xs text-muted-foreground">ハート</p>
          </div>
        </button>
      </div>
    </div>
  );
}

// Step 6: Ratings (optional)
function StepRatings({
  ratings,
  onChangeRating,
}: {
  ratings: { conversation: number; distance: number; technique: number; personality: number };
  onChangeRating: (key: keyof typeof ratings, value: number) => void;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold mb-1">もう少し詳しく教えて</h3>
      <p className="text-sm text-muted-foreground mb-4">
        各項目を1〜5で評価してください（任意・スキップ可）
      </p>
      <div className="space-y-6">
        {parameterLabels.map((item) => (
          <div key={item.id} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{item.leftLabel}</span>
              <span className="font-medium">{item.label}</span>
              <span className="text-muted-foreground">{item.rightLabel}</span>
            </div>
            <Slider
              value={[ratings[item.id as keyof typeof ratings]]}
              onValueChange={([value]) => onChangeRating(item.id as keyof typeof ratings, value)}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Step 7: Score
function StepScore({
  score,
  onChangeScore,
}: {
  score: number;
  onChangeScore: (score: number) => void;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold mb-1">点数をつけるとしたら？</h3>
      <p className="text-sm text-muted-foreground mb-6">
        0〜100点で評価してください（10点刻み）
      </p>
      <div className="text-center mb-6">
        <span className="text-6xl font-bold text-primary">{score}</span>
        <span className="text-2xl text-muted-foreground ml-1">点</span>
      </div>
      <Slider
        value={[score]}
        onValueChange={([value]) => onChangeScore(value)}
        min={0}
        max={100}
        step={10}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-muted-foreground mt-2">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  );
}

// Step 8: Text Review - 3 questions with character limits
function StepText({
  reviewText,
  onChange,
}: {
  reviewText: { q1: string; q2: string; q3: string };
  onChange: (key: keyof typeof reviewText, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold mb-1">最後に感想を教えて</h3>
      <div>
        <label htmlFor="q1" className="block text-sm font-medium mb-1">
          Q1. 第一印象は？（50〜100字）
        </label>
        <Textarea
          id="q1"
          placeholder="写真より可愛くてびっくり！とても明るい笑顔で出迎えてくれて、初めての緊張が一気にほぐれました。雰囲気も良くて安心感がありました。"
          value={reviewText.q1}
          onChange={(e) => onChange("q1", e.target.value)}
          rows={2}
          maxLength={100}
        />
        <p className={cn(
          "text-xs mt-1",
          reviewText.q1.length < 50 ? "text-muted-foreground" : reviewText.q1.length <= 100 ? "text-green-600" : "text-destructive"
        )}>
          {reviewText.q1.length}/100字（最低50字）
        </p>
      </div>
      <div>
        <label htmlFor="q2" className="block text-sm font-medium mb-1">
          Q2. サービス/施術の良かった点は？（100〜150字）
        </label>
        <Textarea
          id="q2"
          placeholder="会話がとても楽しく、施術も丁寧で時間があっという間に過ぎました。技術もしっかりしていてコリがほぐれました。特にアロマの香りが良く、肩甲骨まわりの圧が絶妙で、施術後は体がとても軽くなりました。リラックスできる空間づくりも素晴らしかったです。"
          value={reviewText.q2}
          onChange={(e) => onChange("q2", e.target.value)}
          rows={3}
          maxLength={150}
        />
        <p className={cn(
          "text-xs mt-1",
          reviewText.q2.length < 100 ? "text-muted-foreground" : reviewText.q2.length <= 150 ? "text-green-600" : "text-destructive"
        )}>
          {reviewText.q2.length}/150字（最低100字）
        </p>
      </div>
      <div>
        <label htmlFor="q3" className="block text-sm font-medium mb-1">
          Q3. 気になった点・アドバイスは？（50〜100字）
        </label>
        <Textarea
          id="q3"
          placeholder="人気なので予約は早めがおすすめです。土日は特に取りにくいので平日がねらい目。次回は指名で予約しようと思います。"
          value={reviewText.q3}
          onChange={(e) => onChange("q3", e.target.value)}
          rows={2}
          maxLength={100}
        />
        <p className={cn(
          "text-xs mt-1",
          reviewText.q3.length < 50 ? "text-muted-foreground" : reviewText.q3.length <= 100 ? "text-green-600" : "text-destructive"
        )}>
          {reviewText.q3.length}/100字（最低50字）
        </p>
      </div>
    </div>
  );
}

// Completion Screen - pending approval message
function CompletionScreen({
  onClose,
  onContinue,
  memberType,
  monthlyReviewCount,
}: {
  onClose: () => void;
  onContinue: () => void;
  memberType: "free" | "standard" | "vip";
  monthlyReviewCount: number;
}) {
  return (
    <div className="text-center py-8">
      <div className="h-20 w-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
        <Clock className="h-10 w-10 text-amber-600" />
      </div>
      <h3 className="text-xl font-bold mb-2">投稿ありがとうございます！</h3>
      <p className="text-muted-foreground mb-2">
        管理者の承認後に口コミが公開されます
      </p>

      {memberType === "free" && (
        <p className="text-sm text-muted-foreground mb-6">
          承認後、口コミ閲覧が<span className="text-primary font-bold">3日間</span>解放されます
        </p>
      )}

      {memberType === "standard" && (
        <p className="text-sm text-muted-foreground mb-6">
          承認後、投稿数にカウントされます
        </p>
      )}

      {memberType === "vip" && (
        <p className="text-sm text-muted-foreground mb-6">
          いつもご利用ありがとうございます
        </p>
      )}

      <div className="space-y-3">
        <Button onClick={onClose} className="w-full">
          閉じる
        </Button>
        <Button variant="outline" className="w-full bg-transparent" onClick={onContinue}>
          続けて投稿する
        </Button>
      </div>
    </div>
  );
}
