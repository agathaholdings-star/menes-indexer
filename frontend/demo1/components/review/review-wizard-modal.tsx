"use client";

import React from "react";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Check, Sparkles, Crown, Star, Heart, Smile, Flame, Search, MapPin, AlertCircle, Camera, ImageIcon, Trash2, Gift, Loader2 } from "lucide-react";
import { TherapistImage } from "@/components/shared/therapist-image";
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
import { therapistTypes, bodyTypes, cupTypes, parameterLabels } from "@/lib/data";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

interface DBShop {
  id: number;
  name: string;
  display_name: string | null;
  access: string | null;
  therapist_count?: number;
}

interface DBTherapist {
  id: number;
  name: string;
  image_urls: string[] | null;
  salon_id: number;
}

interface ReviewWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedTherapistId?: number | string;
  memberType?: "free" | "standard" | "vip";
  monthlyReviewCount?: number;
}

const TOTAL_STEPS = 11;

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
  const { user: authUser } = useAuth();
  const router = useRouter();

  const hasPreselected = preselectedTherapistId != null;
  const [step, setStep] = useState(hasPreselected ? 3 : 0);
  const [showAllAreas, setShowAllAreas] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [shopSearch, setShopSearch] = useState("");
  const [therapistSearch, setTherapistSearch] = useState("");
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [selectedTherapistId, setSelectedTherapistId] = useState<number | null>(hasPreselected ? Number(preselectedTherapistId) : null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedBody, setSelectedBody] = useState<string | null>(null);
  const [selectedCup, setSelectedCup] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [ratings, setRatings] = useState({
    conversation: 3,
    distance: 3,
    technique: 3,
    personality: 3,
  });
  const [score, setScore] = useState(80);
  const [reviewText, setReviewText] = useState({
    q0: "",
    q1: "",
    q2: "",
    q3: "",
    q4: "",
    q5: "",
    q6: "",
    q7: "",
  });
  const [isComplete, setIsComplete] = useState(false);
  const [showMissingReport, setShowMissingReport] = useState(false);
  const [missingTherapistName, setMissingTherapistName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verificationImage, setVerificationImage] = useState<File | null>(null);
  const [verificationPreview, setVerificationPreview] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Profile state (auto-fetched)
  const [actualMemberType, setActualMemberType] = useState<"free" | "standard" | "vip">(memberType);
  const [actualMonthlyReviewCount, setActualMonthlyReviewCount] = useState(monthlyReviewCount);

  // DB state
  const [prefectures, setPrefectures] = useState<{ id: number; name: string }[]>([]);
  const [prefecturesWithShops, setPrefecturesWithShops] = useState<{ id: number; name: string; shop_count: number }[]>([]);
  const [dbShops, setDbShops] = useState<DBShop[]>([]);
  const [dbTherapists, setDbTherapists] = useState<DBTherapist[]>([]);
  const [directSearchMode, setDirectSearchMode] = useState(false);
  const [directShopSearch, setDirectShopSearch] = useState("");
  const [directSearchResults, setDirectSearchResults] = useState<DBShop[]>([]);
  const [shopStepSkipped, setShopStepSkipped] = useState(hasPreselected);

  // Fetch user profile (membership_type, monthly_review_count)
  useEffect(() => {
    if (!open || !authUser) return;
    const fetchProfile = async () => {
      const supabase = createSupabaseBrowser();
      const { data } = await supabase
        .from("profiles")
        .select("membership_type, monthly_review_count")
        .eq("id", authUser.id)
        .single();
      if (data) {
        setActualMemberType((data.membership_type as "free" | "standard" | "vip") || "free");
        setActualMonthlyReviewCount(data.monthly_review_count || 0);
      }
    };
    fetchProfile();
  }, [open, authUser]);

  // Fetch prefectures on mount + which ones have shops
  useEffect(() => {
    if (!open) return;
    const fetchPrefectures = async () => {
      const res = await fetch("/api/prefectures");
      const data = await res.json();
      if (Array.isArray(data)) {
        setPrefectures(data.map((p: any) => ({ id: p.id, name: p.name })));

        // Get areas to count shops per prefecture
        const areasRes = await fetch("/api/areas");
        const areas = await areasRes.json();
        if (Array.isArray(areas)) {
          const prefCounts = new Map<number, number>();
          areas.forEach((a: any) => {
            prefCounts.set(a.prefecture_id, (prefCounts.get(a.prefecture_id) || 0) + (a.salon_count || 0));
          });
          const withShops = data
            .filter((p: any) => prefCounts.has(p.id))
            .map((p: any) => ({ id: p.id, name: p.name, shop_count: prefCounts.get(p.id) || 0 }));
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
      const res = await fetch(`/api/salons?search=${encodeURIComponent(directShopSearch)}&limit=30`);
      const data = await res.json();
      if (Array.isArray(data)) setDirectSearchResults(data);
    }, 300);
    return () => clearTimeout(timer);
  }, [directShopSearch, directSearchMode]);

  // Fetch shops when area (prefecture) selected
  useEffect(() => {
    if (!selectedArea) { setDbShops([]); return; }
    const fetchShops = async () => {
      const prefecture = prefectures.find(p => p.name === selectedArea)
        || prefectures.find(p => p.name === prefectureShortNames[selectedArea])
        || prefectures.find(p => p.name.startsWith(selectedArea));
      if (!prefecture) return;
      const areasRes = await fetch(`/api/areas?prefecture_id=${prefecture.id}`);
      const areaData = await areasRes.json();
      if (!Array.isArray(areaData) || areaData.length === 0) { setDbShops([]); return; }

      // Fetch salons for each area and dedupe
      const shopMap = new Map<number, DBShop>();
      for (const area of areaData) {
        const salonsRes = await fetch(`/api/salons?area_id=${area.id}&limit=50`);
        const salons = await salonsRes.json();
        if (Array.isArray(salons)) {
          salons.forEach((s: any) => {
            if (!shopMap.has(s.id)) {
              shopMap.set(s.id, { id: s.id, name: s.name, display_name: s.display_name, access: s.access, therapist_count: s.therapist_count ?? 0 });
            }
          });
        }
      }
      setDbShops(Array.from(shopMap.values()));
    };
    fetchShops();
  }, [selectedArea, prefectures]);

  // Fetch therapists when shop selected
  useEffect(() => {
    if (!selectedShopId) { setDbTherapists([]); return; }
    const fetchTherapists = async () => {
      const res = await fetch(`/api/therapists?salon_id=${selectedShopId}&limit=50`);
      const data = await res.json();
      if (Array.isArray(data)) setDbTherapists(data as unknown as DBTherapist[]);
    };
    fetchTherapists();
  }, [selectedShopId]);

  // Handle preselected therapist - fetch directly by ID
  useEffect(() => {
    if (!open || !preselectedTherapistId) return;
    const fetchPreselected = async () => {
      const therapistId = Number(preselectedTherapistId);
      const res = await fetch(`/api/therapists?ids=${therapistId}&limit=1`);
      const data = await res.json();
      const found = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (found) {
        setSelectedTherapistId(found.id);
        setSelectedShopId(found.salon_id);
        setShopStepSkipped(true);
        setStep(3);
      }
    };
    fetchPreselected();
  }, [open, preselectedTherapistId]);

  // Filter shops by search (client-side on already-fetched data)
  const filteredShops = dbShops.filter(shop => {
    const displayName = shop.display_name || shop.name;
    return displayName.toLowerCase().includes(shopSearch.toLowerCase()) ||
      displayName.includes(shopSearch);
  });

  // Filter therapists by search + deduplicate by name (keep first occurrence)
  const filteredTherapists = dbTherapists.filter(t =>
    t.name.toLowerCase().includes(therapistSearch.toLowerCase()) ||
    t.name.includes(therapistSearch)
  ).filter((t, i, arr) => arr.findIndex(x => x.name === t.name) === i);

  // All prefecture names for area selector
  const allAreas = prefectures.map(p => p.name);

  const handleNext = async () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      // 最終ステップ (Step 9): DBに口コミを保存
      if (!authUser) {
        onOpenChange(false);
        router.push("/login?redirect=/review");
        return;
      }
      if (!selectedShopId || !selectedTherapistId) {
        return;
      }

      setSubmitting(true);
      try {
        const supabase = createSupabaseBrowser();
        let imagePath: string | null = null;

        // 画像がある場合 → Supabase Storage にアップロード
        if (verificationImage) {
          const ext = verificationImage.name.split(".").pop() || "jpg";
          const filePath = `${authUser.id}/${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("review-verifications")
            .upload(filePath, verificationImage);
          if (uploadError) {
            console.error("Image upload failed:", uploadError);
          } else {
            imagePath = filePath;
          }
        }

        const { error } = await supabase.from("reviews").insert({
          user_id: authUser.id,
          therapist_id: selectedTherapistId,
          salon_id: selectedShopId,
          looks_type_id: Number(selectedType),
          body_type_id: Number(selectedBody),
          cup_type_id: Number(selectedCup),
          service_level_id: Number(selectedService),
          param_conversation: ratings.conversation,
          param_distance: ratings.distance,
          param_technique: ratings.technique,
          param_personality: ratings.personality,
          score: score,
          comment_reason: reviewText.q0,
          comment_first_impression: reviewText.q1,
          comment_style: reviewText.q2,
          comment_service: reviewText.q3,
          comment_service_detail: reviewText.q4,
          comment_cost: reviewText.q5,
          comment_revisit: reviewText.q6,
          comment_advice: reviewText.q7,
          verification_image_path: imagePath,
        });

        if (error) {
          console.error("Review insert failed:", error);
          setErrorMessage("投稿に失敗しました。もう一度お試しください。");
          return;
        }
        setErrorMessage(null);
        setIsComplete(true);
      } catch (err) {
        console.error("Review submission error:", err);
        setErrorMessage("投稿中にエラーが発生しました。もう一度お試しください。");
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    // preselected時はstep 3が最初なので、それ以前には戻れない
    if (hasPreselected && step <= 3) return;
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

  const handleCupSelect = (cupId: string) => {
    setSelectedCup(cupId);
    setTimeout(() => setStep(6), 300);
  };

  const handleServiceSelect = (serviceId: string) => {
    setSelectedService(serviceId);
    setTimeout(() => setStep(7), 300);
  };

  const handleClose = () => {
    setStep(hasPreselected ? 3 : 0);
    setShowAllAreas(false);
    setSelectedArea(null);
    setShopSearch("");
    setTherapistSearch("");
    setSelectedShopId(null);
    setSelectedTherapistId(hasPreselected ? Number(preselectedTherapistId) : null);
    setSelectedType(null);
    setSelectedBody(null);
    setSelectedCup(null);
    setSelectedService(null);
    setRatings({ conversation: 3, distance: 3, technique: 3, personality: 3 });
    setScore(80);
    setReviewText({ q0: "", q1: "", q2: "", q3: "", q4: "", q5: "", q6: "", q7: "" });
    setIsComplete(false);
    setShowMissingReport(false);
    setMissingTherapistName("");
    setShopStepSkipped(hasPreselected);
    setVerificationImage(null);
    setVerificationPreview(null);
    onOpenChange(false);
  };

  const canProceed = () => {
    switch (step) {
      case 0: return selectedArea !== null;
      case 1: return selectedShopId !== null;
      case 2: return selectedTherapistId !== null;
      case 3: return selectedType !== null;
      case 4: return selectedBody !== null;
      case 5: return selectedCup !== null;
      case 6: return selectedService !== null;
      case 7: return true; // Ratings are optional
      case 8: return true; // Score always has default
      case 9: return reviewText.q0.length >= 30 && reviewText.q3.length >= 30 && reviewText.q6.length >= 30;
      case 10: return true; // 画像は任意なので常にtrue
      default: return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">
              {isComplete ? "投稿完了" : "口コミ投稿"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Progress Bar */}
        {!isComplete && (() => {
          const skippedSteps = hasPreselected ? 3 : shopStepSkipped ? 1 : 0;
          const totalSteps = TOTAL_STEPS - skippedSteps;
          const currentStep = hasPreselected ? step - 3 : shopStepSkipped && step >= 2 ? step - 1 : step;
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

        {/* Error Message */}
        {errorMessage && (
          <div className="mx-6 mt-2 p-3 bg-destructive/10 text-destructive text-sm rounded-lg flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMessage}
          </div>
        )}

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
                setSelectedCup(null);
                setSelectedService(null);
                setRatings({ conversation: 3, distance: 3, technique: 3, personality: 3 });
                setScore(80);
                setReviewText({ q0: "", q1: "", q2: "", q3: "", q4: "", q5: "", q6: "", q7: "" });
                setIsComplete(false);
                setShowMissingReport(false);
                setMissingTherapistName("");
                setShopStepSkipped(false);
                setDirectSearchMode(false);
                setDirectShopSearch("");
                setDirectSearchResults([]);
                setVerificationImage(null);
                setVerificationPreview(null);
              }}
              /* 「続けて書く」は別セラピスト対象なのでstep 0（エリア選択）から */
              memberType={actualMemberType}
              monthlyReviewCount={actualMonthlyReviewCount}
              hasScreenshot={!!verificationImage}
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
                  selectedShopId={selectedShopId}
                />
              )}
              {step === 3 && (
                <StepType selectedType={selectedType} onSelect={handleTypeSelect} />
              )}
              {step === 4 && (
                <StepBody selectedBody={selectedBody} onSelect={handleBodySelect} />
              )}
              {step === 5 && (
                <StepCup selectedCup={selectedCup} onSelect={handleCupSelect} />
              )}
              {step === 6 && (
                <StepService selectedService={selectedService} onSelect={handleServiceSelect} />
              )}
              {step === 7 && (
                <StepRatings
                  ratings={ratings}
                  onChangeRating={(key, value) => setRatings(prev => ({ ...prev, [key]: value }))}
                />
              )}
              {step === 8 && (
                <StepScore score={score} onChangeScore={setScore} />
              )}
              {step === 9 && (
                <StepText
                  reviewText={reviewText}
                  onChange={(key, value) => setReviewText(prev => ({ ...prev, [key]: value }))}
                />
              )}
              {step === 10 && (
                <StepVerificationImage
                  image={verificationImage}
                  preview={verificationPreview}
                  onSelect={(file) => {
                    setVerificationImage(file);
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setVerificationPreview(url);
                    }
                  }}
                  onRemove={() => {
                    setVerificationImage(null);
                    if (verificationPreview) {
                      URL.revokeObjectURL(verificationPreview);
                    }
                    setVerificationPreview(null);
                  }}
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
              disabled={hasPreselected ? step <= 3 : step === 0}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              戻る
            </Button>
            <span className="text-sm text-muted-foreground">
              {(() => {
                const skipped = hasPreselected ? 3 : shopStepSkipped && step >= 2 ? 1 : 0;
                const total = TOTAL_STEPS - (hasPreselected ? 3 : shopStepSkipped ? 1 : 0);
                return `${step - skipped + 1} / ${total}`;
              })()}
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

      {prefecturesWithShops.length === 0 && allAreas.length === 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
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
      )}
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
  // Popular salons: top 5 by therapist_count
  const popularShops = [...filteredShops]
    .filter(s => (s.therapist_count ?? 0) > 0)
    .sort((a, b) => (b.therapist_count ?? 0) - (a.therapist_count ?? 0))
    .slice(0, 5);

  return (
    <div>
      <h3 className="text-base font-semibold mb-1">{selectedArea}のサロンを選択</h3>
      <p className="text-sm text-muted-foreground mb-4">
        ひらがな・カタカナで検索できます
      </p>

      {/* Popular salons chips */}
      {popularShops.length > 0 && !shopSearch && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-primary mb-2">人気サロン</p>
          <div className="flex flex-wrap gap-2">
            {popularShops.map(shop => (
              <button
                key={shop.id}
                type="button"
                onClick={() => onSelect(shop.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                  selectedShopId === shop.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
                )}
              >
                {shop.display_name || shop.name}
              </button>
            ))}
          </div>
        </div>
      )}

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
        {filteredShops.length === 0 && selectedArea && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <p className="text-sm">サロンを読み込み中...</p>
          </div>
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
  selectedShopId,
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
  selectedShopId: number | null;
}) {
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const handleReportSubmit = async () => {
    if (!missingTherapistName.trim()) return;
    setReportSubmitting(true);
    try {
      const res = await fetch("/api/missing-therapist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapist_name: missingTherapistName.trim(),
          salon_id: selectedShopId,
        }),
      });
      if (res.ok) {
        setReportSubmitted(true);
        setTimeout(() => {
          setShowMissingReport(false);
          setMissingTherapistName("");
          setReportSubmitted(false);
        }, 2000);
      }
    } catch {
      // silently fail
    } finally {
      setReportSubmitting(false);
    }
  };
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
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
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
                <TherapistImage
                  src={t.image_urls?.[0]}
                  alt={t.name}
                  fill
                  className="object-cover"
                />
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
              <Button
                size="sm"
                disabled={!missingTherapistName.trim() || reportSubmitting || reportSubmitted}
                onClick={handleReportSubmit}
              >
                {reportSubmitted ? "報告を受け付けました" : reportSubmitting ? "送信中..." : "報告する"}
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

// Step 5: Cup Type Selection
function StepCup({
  selectedCup,
  onSelect,
}: {
  selectedCup: string | null;
  onSelect: (cup: string) => void;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold mb-1">バストサイズは？</h3>
      <p className="text-sm text-muted-foreground mb-4">
        体感で最も近いものを1つ選んでください
      </p>
      <div className="grid grid-cols-2 gap-3">
        {cupTypes.map((ct) => (
          <button
            key={ct.id}
            type="button"
            onClick={() => onSelect(ct.id)}
            className={cn(
              "flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all",
              selectedCup === ct.id
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            <span className="font-medium text-sm">{ct.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Step 6: Service Selection - 3 choices
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
          onClick={() => onSelect("1")}
          className={cn(
            "flex items-center justify-center p-4 rounded-xl border-2 transition-all",
            selectedService === "1"
              ? "border-primary bg-green-50 ring-2 ring-primary/20"
              : "border-border bg-green-50/50 hover:border-primary/50"
          )}
        >
          <span className="font-medium">健全</span>
        </button>

        {/* SKR */}
        <button
          type="button"
          onClick={() => onSelect("2")}
          className={cn(
            "flex items-center justify-center p-4 rounded-xl border-2 transition-all",
            selectedService === "2"
              ? "border-primary bg-amber-50 ring-2 ring-primary/20"
              : "border-border bg-amber-50/50 hover:border-primary/50"
          )}
        >
          <span className="font-medium">SKR</span>
        </button>

        {/* HR */}
        <button
          type="button"
          onClick={() => onSelect("3")}
          className={cn(
            "flex items-center justify-center p-4 rounded-xl border-2 transition-all",
            selectedService === "3"
              ? "border-primary bg-pink-50 ring-2 ring-primary/20"
              : "border-border bg-pink-50/50 hover:border-primary/50"
          )}
        >
          <span className="font-medium">HR</span>
        </button>
      </div>
    </div>
  );
}

// Step 7: Ratings (optional)
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

// Step 8: Score
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

// Step 9: Text Review - 3 required + 5 optional questions
function StepText({
  reviewText,
  onChange,
}: {
  reviewText: { q0: string; q1: string; q2: string; q3: string; q4: string; q5: string; q6: string; q7: string };
  onChange: (key: keyof typeof reviewText, value: string) => void;
}) {
  const questions = [
    { key: "q0" as const, label: "Q1. 行ったきっかけは？", placeholder: "ネットの口コミで高評価だったので初来店。指名なしで予約しました。", min: 30, max: 200, required: true },
    { key: "q3" as const, label: "Q2. 施術内容・サービスはどうでしたか？", placeholder: "アロマの香りが心地よく、指圧の強さも都度確認してくれて安心でした。会話のテンポも良く、あっという間の90分。", min: 30, max: 300, required: true },
    { key: "q6" as const, label: "Q3. また行きたいと思いますか？", placeholder: "確実にリピートします。次回は指名して120分で予約する予定です！", min: 30, max: 200, required: true },
    { key: "q1" as const, label: "Q4. 第一印象は？", placeholder: "写真通りの清楚な雰囲気で、笑顔が素敵。部屋に入った瞬間に緊張がほぐれました。", min: 0, max: 200, required: false },
    { key: "q2" as const, label: "Q5. 特に良かった点は？", placeholder: "力加減が絶妙で、肩まわりの凝りが一気に楽になりました。手技のバリエーションも豊富。", min: 0, max: 200, required: false },
    { key: "q4" as const, label: "Q6. 気になった点・改善点は？", placeholder: "強いて言えば、施術中のBGMがもう少し静かだと更にリラックスできたかも。", min: 0, max: 200, required: false },
    { key: "q5" as const, label: "Q7. コスパはどうでしたか？", placeholder: "90分12,000円で大満足。同エリアの他店と比べてもコスパは抜群だと思います。", min: 0, max: 200, required: false },
    { key: "q7" as const, label: "Q8. その他コメント", placeholder: "お店の清潔感◎。シャワールームも広くて快適でした。アメニティも充実。", min: 0, max: 200, required: false },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold mb-1">最後に感想を教えて</h3>
      <p className="text-sm text-muted-foreground">Q1〜Q3は必須です。Q4以降は任意ですが、書くほど他のユーザーの参考になります。</p>
      {questions.map((q) => (
        <div key={q.key}>
          <label htmlFor={q.key} className="block text-sm font-medium mb-1">
            {q.label}
            {q.required ? (
              <span className="text-xs text-destructive ml-1">（必須・{q.min}字以上）</span>
            ) : (
              <span className="text-xs text-muted-foreground ml-1">（任意）</span>
            )}
          </label>
          <Textarea
            id={q.key}
            placeholder={q.placeholder}
            value={reviewText[q.key]}
            onChange={(e) => onChange(q.key, e.target.value)}
            rows={2}
            maxLength={q.max}
          />
          <p className={cn(
            "text-xs mt-1",
            !q.required ? "text-muted-foreground" :
            reviewText[q.key].length < q.min ? "text-muted-foreground" : "text-green-600"
          )}>
            {reviewText[q.key].length}/{q.max}字
            {q.required && reviewText[q.key].length < q.min && (
              <span className="text-destructive ml-1">（あと{q.min - reviewText[q.key].length}字）</span>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}

// Step 10: Verification Image Upload (optional)
function StepVerificationImage({
  image,
  preview,
  onSelect,
  onRemove,
}: {
  image: File | null;
  preview: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 10MB制限
    if (file.size > 10 * 1024 * 1024) {
      alert("ファイルサイズは10MB以下にしてください");
      return;
    }
    onSelect(file);
  };

  return (
    <div>
      <h3 className="text-base font-semibold mb-1">予約スクショを添付（任意）</h3>
      <p className="text-sm text-muted-foreground mb-4">
        予約スクショを添付すると「認証済み」バッジ + ボーナス5クレジット獲得！スキップしても投稿できます。
      </p>

      {preview ? (
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden border">
            <img
              src={preview}
              alt="予約スクショプレビュー"
              className="w-full max-h-64 object-contain bg-muted"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground truncate max-w-[200px]">
              {image?.name}
            </p>
            <Button variant="ghost" size="sm" onClick={onRemove} className="text-destructive gap-1">
              <Trash2 className="h-3.5 w-3.5" />
              削除
            </Button>
          </div>
        </div>
      ) : (
        <label
          htmlFor="verification-image"
          className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
        >
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Camera className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium text-sm">タップして画像を選択</p>
            <p className="text-xs text-muted-foreground mt-1">JPEG, PNG（最大10MB）</p>
          </div>
          <input
            id="verification-image"
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
      )}

      <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
        <div className="flex items-start gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground">
            <p>スクショは管理者のみ確認し、一般公開されません。番号や個人情報が気になる場合は、事前にモザイク加工してください。運営が責任を持って安全に管理します。</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Completion Screen - immediate reward feel
function CompletionScreen({
  onClose,
  onContinue,
  memberType,
  monthlyReviewCount,
  hasScreenshot,
}: {
  onClose: () => void;
  onContinue: () => void;
  memberType: "free" | "standard" | "vip";
  monthlyReviewCount: number;
  hasScreenshot: boolean;
}) {
  return (
    <div className="text-center py-8">
      {/* Animated check icon */}
      <div className="relative mx-auto mb-6 w-20 h-20">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 shadow-lg animate-[scale-up_0.3s_ease-out]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Check className="h-10 w-10 text-green-600" />
        </div>
        {/* Sparkle decorations */}
        <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-yellow-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
        <div className="absolute -bottom-1 -left-1 h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>

      <h3 className="text-xl font-bold mb-2">口コミが送信されました</h3>

      {/* Credit reward banner */}
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Gift className="h-5 w-5 text-amber-600" />
          <span className="font-bold text-amber-700 text-lg">+{hasScreenshot ? 10 : 5} クレジット獲得予定!</span>
        </div>
        <p className="text-xs text-amber-600">管理者が確認後、通常30分以内にクレジットが付与されます</p>
        <p className="text-xs text-amber-600 mt-1">承認されるとメールでお知らせします</p>
      </div>

      {memberType === "free" && (
        <div className="bg-primary/5 rounded-lg p-4 mb-4 text-sm">
          <p className="text-muted-foreground">
            <span className="text-primary font-bold">{hasScreenshot ? 10 : 5}クレジット</span>で
            セラピスト{hasScreenshot ? 10 : 5}人分の口コミが読めるようになります
          </p>
        </div>
      )}

      {memberType === "standard" && (
        <div className="bg-primary/5 rounded-lg p-4 mb-4 text-sm">
          <p className="text-muted-foreground">
            今月の投稿: <span className="text-primary font-bold">{monthlyReviewCount + 1}/3</span>本
            {monthlyReviewCount + 1 >= 3 && (
              <span className="block mt-1 text-primary font-semibold">VIP相当の全機能が解放！</span>
            )}
          </p>
        </div>
      )}

      <p className="text-sm text-muted-foreground mb-6">
        通常30分以内に審査が完了します
      </p>

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
