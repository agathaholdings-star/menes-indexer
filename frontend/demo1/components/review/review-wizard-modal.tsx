"use client";

import React from "react";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Check, Sparkles, Crown, Star, Heart, Smile, Flame, Search, MapPin, AlertCircle, Camera, ImageIcon, Trash2, Gift, Loader2, Mail, Lock, User, Eye, EyeOff, MailCheck } from "lucide-react";
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
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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

export interface PrefillContext {
  therapistId: number | string;
  therapistName: string;
  salonId: number | string;
  salonName: string;
  areaName?: string;
}

interface ReviewWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedTherapistId?: number | string;
  prefill?: PrefillContext;
  memberType?: "free" | "standard" | "vip";
  monthlyReviewCount?: number;
}

const TOTAL_STEPS = 12; // 0-10: review steps, 11: registration (guest only)

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

export function ReviewWizardModal({ open, onOpenChange, preselectedTherapistId, prefill, memberType = "free", monthlyReviewCount = 0 }: ReviewWizardModalProps) {
  const { user: authUser } = useAuth();
  const router = useRouter();

  const hasPreselected = preselectedTherapistId != null || prefill != null;
  const [step, setStep] = useState(hasPreselected ? 3 : 0);
  const [showAllAreas, setShowAllAreas] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [shopSearch, setShopSearch] = useState("");
  const [therapistSearch, setTherapistSearch] = useState("");
  const [selectedShopId, setSelectedShopId] = useState<number | null>(prefill ? Number(prefill.salonId) : null);
  const [selectedTherapistId, setSelectedTherapistId] = useState<number | null>(
    prefill ? Number(prefill.therapistId) : hasPreselected ? Number(preselectedTherapistId) : null
  );
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
  const [screenshotUploadFailed, setScreenshotUploadFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Guest registration state (step 11)
  const [guestForm, setGuestForm] = useState({ nickname: "", email: "", password: "" });
  const [guestAgreed, setGuestAgreed] = useState(false);
  const [showGuestPassword, setShowGuestPassword] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);

  // Profile state (auto-fetched)
  const [actualMemberType, setActualMemberType] = useState<"free" | "standard" | "vip">(memberType);
  const [actualMonthlyReviewCount, setActualMonthlyReviewCount] = useState(monthlyReviewCount);

  // DB state
  const [prefectures, setPrefectures] = useState<{ id: number; name: string }[]>([]);
  const [prefecturesWithShops, setPrefecturesWithShops] = useState<{ id: number; name: string; shop_count: number }[]>([]);
  const [dbShops, setDbShops] = useState<DBShop[]>([]);
  const [dbTherapists, setDbTherapists] = useState<DBTherapist[]>([]);
  const [directShopSearch, setDirectShopSearch] = useState("");
  const [directSearchResults, setDirectSearchResults] = useState<DBShop[]>([]);
  const [prefillUsed, setPrefillUsed] = useState(prefill != null);
  const [shopStepSkipped, setShopStepSkipped] = useState(hasPreselected);

  // Fetch user profile (membership_type, monthly_review_count) - only for logged-in users
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
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        setPrefectures(data.map((p: any) => ({ id: p.id, name: p.name })));

        // Get areas to count shops per prefecture
        const areasRes = await fetch("/api/areas");
        if (!areasRes.ok) return;
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
    if (directShopSearch.length < 1) { setDirectSearchResults([]); return; }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/salons?search=${encodeURIComponent(directShopSearch)}&limit=30`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setDirectSearchResults(data);
    }, 300);
    return () => clearTimeout(timer);
  }, [directShopSearch]);

  // Fetch shops when area (prefecture) selected
  useEffect(() => {
    if (!selectedArea) { setDbShops([]); return; }
    const fetchShops = async () => {
      const prefecture = prefectures.find(p => p.name === selectedArea)
        || prefectures.find(p => p.name === prefectureShortNames[selectedArea])
        || prefectures.find(p => p.name.startsWith(selectedArea));
      if (!prefecture) return;
      const salonsRes = await fetch(`/api/salons?prefecture_id=${prefecture.id}&limit=200`);
      if (!salonsRes.ok) { setDbShops([]); return; }
      const salons = await salonsRes.json();
      if (!Array.isArray(salons) || salons.length === 0) { setDbShops([]); return; }
      setDbShops(salons.map((s: any) => ({ id: s.id, name: s.name, display_name: s.display_name, access: s.access, therapist_count: s.therapist_count ?? 0 })));
    };
    fetchShops();
  }, [selectedArea, prefectures]);

  // Fetch therapists when shop selected
  useEffect(() => {
    if (!selectedShopId) { setDbTherapists([]); return; }
    const fetchTherapists = async () => {
      const res = await fetch(`/api/therapists?salon_id=${selectedShopId}&limit=50`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setDbTherapists(data as unknown as DBTherapist[]);
    };
    fetchTherapists();
  }, [selectedShopId]);

  // Handle prefill context - use provided data directly (no API call)
  useEffect(() => {
    if (!open || !prefill) return;
    setSelectedTherapistId(Number(prefill.therapistId));
    setSelectedShopId(Number(prefill.salonId));
    setShopStepSkipped(true);
    setPrefillUsed(true);
    setStep(3);
  }, [open, prefill]);

  // Handle preselected therapist (legacy) - fetch directly by ID
  useEffect(() => {
    if (!open || !preselectedTherapistId || prefill) return;
    const fetchPreselected = async () => {
      const therapistId = Number(preselectedTherapistId);
      const res = await fetch(`/api/therapists?ids=${therapistId}&limit=1`);
      if (!res.ok) return;
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
  }, [open, preselectedTherapistId, prefill]);

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

  // Helper: insert review into DB
  const submitReview = async (userId: string) => {
    const supabase = createSupabaseBrowser();
    let imagePath: string | null = null;

    // 画像がある場合 → Supabase Storage にアップロード
    if (verificationImage) {
      const ext = verificationImage.name.split(".").pop() || "jpg";
      const filePath = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("review-verifications")
        .upload(filePath, verificationImage);
      if (uploadError) {
        console.error("Image upload failed:", uploadError);
        setScreenshotUploadFailed(true);
      } else {
        imagePath = filePath;
      }
    }

    const { error } = await supabase.from("reviews").insert({
      user_id: userId,
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

    return error;
  };

  // Guest registration + review submit
  const handleGuestSubmit = async () => {
    if (!guestAgreed || !guestForm.email || !guestForm.password || guestForm.password.length < 6) return;
    if (!selectedShopId || !selectedTherapistId) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = createSupabaseBrowser();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: guestForm.email,
        password: guestForm.password,
        options: {
          data: { nickname: guestForm.nickname },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setErrorMessage(signUpError.message);
        setSubmitting(false);
        return;
      }

      // 既存ユーザーチェック
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setErrorMessage("このメールアドレスは既に登録されています。ログインページからお試しください。");
        setSubmitting(false);
        return;
      }

      // ローカル開発（メール確認不要）: sessionがあるのでそのまま投稿
      if (data.session && data.user) {
        const reviewError = await submitReview(data.user.id);
        if (reviewError) {
          console.error("Review insert failed:", reviewError);
          setErrorMessage("口コミの保存に失敗しました。もう一度お試しください。");
          setSubmitting(false);
          return;
        }
        setIsComplete(true);
        setSubmitting(false);
        return;
      }

      // 本番（メール確認必要）: APIでservice_role経由で口コミを保存
      if (data.user) {
        const fd = new FormData();
        fd.append("user_id", data.user.id);
        fd.append("therapist_id", String(selectedTherapistId));
        fd.append("salon_id", String(selectedShopId));
        fd.append("looks_type_id", String(Number(selectedType)));
        fd.append("body_type_id", String(Number(selectedBody)));
        fd.append("cup_type_id", String(Number(selectedCup)));
        fd.append("service_level_id", String(Number(selectedService)));
        fd.append("param_conversation", String(ratings.conversation));
        fd.append("param_distance", String(ratings.distance));
        fd.append("param_technique", String(ratings.technique));
        fd.append("param_personality", String(ratings.personality));
        fd.append("score", String(score));
        fd.append("comment_reason", reviewText.q0);
        fd.append("comment_first_impression", reviewText.q1);
        fd.append("comment_style", reviewText.q2);
        fd.append("comment_service", reviewText.q3);
        fd.append("comment_service_detail", reviewText.q4);
        fd.append("comment_cost", reviewText.q5);
        fd.append("comment_revisit", reviewText.q6);
        fd.append("comment_advice", reviewText.q7);
        if (verificationImage) {
          fd.append("verification_image", verificationImage);
        }

        const res = await fetch("/api/reviews/guest-submit", {
          method: "POST",
          body: fd,
        });

        if (!res.ok) {
          setErrorMessage("口コミの保存に失敗しました。もう一度お試しください。");
          setSubmitting(false);
          return;
        }
      }

      setShowEmailConfirmation(true);
      setSubmitting(false);
    } catch (err) {
      console.error("Guest submit error:", err);
      setErrorMessage("投稿中にエラーが発生しました。もう一度お試しください。");
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    // step 10 (画像アップロード) の次:
    // - ログイン済み → DB保存して完了
    // - 未ログイン → step 11 (登録フォーム) へ
    if (step === 10) {
      if (authUser) {
        // ログイン済み: 従来通りDB保存
        if (!selectedShopId || !selectedTherapistId) return;
        setSubmitting(true);
        try {
          const reviewError = await submitReview(authUser.id);
          if (reviewError) {
            console.error("Review insert failed:", reviewError);
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
      } else {
        // 未ログイン: 登録ステップへ
        setStep(11);
      }
      return;
    }

    // step 11 (登録フォーム) の送信
    if (step === 11) {
      await handleGuestSubmit();
      return;
    }

    // その他のステップ: 次へ進む
    if (step < 10) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    // prefill使用時: step 3で戻るとprefill解除してstep 0へ
    if (prefillUsed && step <= 3) {
      setPrefillUsed(false);
      setShopStepSkipped(false);
      setSelectedArea(null);
      setSelectedShopId(null);
      setSelectedTherapistId(null);
      setStep(0);
      return;
    }
    // legacy preselected時はstep 3が最初なので、それ以前には戻れない
    if (hasPreselected && !prefill && step <= 3) return;
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
    setSelectedShopId(prefill ? Number(prefill.salonId) : null);
    setSelectedTherapistId(
      prefill ? Number(prefill.therapistId) : hasPreselected ? Number(preselectedTherapistId) : null
    );
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
    setPrefillUsed(prefill != null);
    setShopStepSkipped(hasPreselected);
    setVerificationImage(null);
    setVerificationPreview(null);
    setGuestForm({ nickname: "", email: "", password: "" });
    setGuestAgreed(false);
    setShowGuestPassword(false);
    setShowEmailConfirmation(false);
    setErrorMessage(null);
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
      case 9: return reviewText.q0.trim().length >= 30 && reviewText.q3.trim().length >= 30 && reviewText.q6.trim().length >= 30;
      case 10: return true; // 画像は任意なので常にtrue
      case 11: return guestForm.nickname.trim() !== "" && guestForm.email.trim() !== "" && guestForm.password.length >= 6 && guestAgreed;
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
        {!isComplete && !showEmailConfirmation && (() => {
          const skippedSteps = hasPreselected ? 3 : shopStepSkipped ? 1 : 0;
          // For logged-in users, total is 11 (steps 0-10); for guests, 12 (steps 0-11)
          const effectiveTotalSteps = authUser ? TOTAL_STEPS - 1 : TOTAL_STEPS;
          const totalSteps = effectiveTotalSteps - skippedSteps;
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
                <StepArea
                  selectedArea={selectedArea}
                  onSelect={handleAreaSelect}
                  showAllAreas={showAllAreas}
                  setShowAllAreas={setShowAllAreas}
                  allAreas={allAreas}
                  prefecturesWithShops={prefecturesWithShops}
                  directShopSearch={directShopSearch}
                  setDirectShopSearch={setDirectShopSearch}
                  directSearchResults={directSearchResults}
                  onSelectShop={(shop) => {
                    setSelectedShopId(shop.id);
                    setShopStepSkipped(true);
                    setTimeout(() => setStep(2), 300);
                  }}
                />
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
                <>
                  {prefillUsed && prefill && (
                    <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                      <span className="text-muted-foreground">投稿対象: </span>
                      <span className="font-medium">{prefill.salonName}</span>
                      <span className="text-muted-foreground"> / </span>
                      <span className="font-medium">{prefill.therapistName}</span>
                    </div>
                  )}
                  <StepType selectedType={selectedType} onSelect={handleTypeSelect} />
                </>
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
              {step === 11 && (
                showEmailConfirmation ? (
                  <div className="text-center py-8">
                    <div className="relative mx-auto mb-6 w-20 h-20">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 shadow-lg" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <MailCheck className="h-10 w-10 text-blue-600" />
                      </div>
                    </div>
                    <h3 className="text-xl font-bold mb-2">口コミ投稿 + 登録完了!</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      確認メールを <span className="font-medium text-foreground">{guestForm.email}</span> に送信しました。
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm text-blue-700">
                      <p className="font-medium mb-1">メール内のリンクをクリックして登録を完了してください</p>
                      <p className="text-xs">確認後、クレジットが付与され口コミが閲覧できるようになります</p>
                    </div>
                    <Button onClick={handleClose} className="w-full">
                      閉じる
                    </Button>
                  </div>
                ) : (
                  <StepRegistration
                    guestForm={guestForm}
                    setGuestForm={setGuestForm}
                    guestAgreed={guestAgreed}
                    setGuestAgreed={setGuestAgreed}
                    showPassword={showGuestPassword}
                    setShowPassword={setShowGuestPassword}
                  />
                )
              )}
            </>
          )}
        </div>

        {/* Navigation */}
        {!isComplete && !showEmailConfirmation && (
          <div className="flex items-center justify-between p-6 pt-0 border-t mt-4">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={prefillUsed ? step < 3 : (hasPreselected && !prefill) ? step <= 3 : step === 0}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              戻る
            </Button>
            <span className="text-sm text-muted-foreground">
              {(() => {
                const skipped = hasPreselected ? 3 : shopStepSkipped && step >= 2 ? 1 : 0;
                const effectiveTotal = authUser ? TOTAL_STEPS - 1 : TOTAL_STEPS;
                const total = effectiveTotal - (hasPreselected ? 3 : shopStepSkipped ? 1 : 0);
                return `${step - skipped + 1} / ${total}`;
              })()}
            </span>
            <Button onClick={handleNext} disabled={!canProceed() || submitting} className="gap-1">
              {submitting ? "投稿中..." :
                step === 11 ? "登録して投稿する" :
                step === 10 && authUser ? "投稿する" :
                step === 10 && !authUser ? "次へ" :
                "次へ"}
              {step < 10 && !submitting && <ChevronRight className="h-4 w-4" />}
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
  directShopSearch,
  setDirectShopSearch,
  directSearchResults,
  onSelectShop,
}: {
  selectedArea: string | null;
  onSelect: (area: string) => void;
  showAllAreas: boolean;
  setShowAllAreas: (v: boolean) => void;
  allAreas: string[];
  prefecturesWithShops: { id: number; name: string; shop_count: number }[];
  directShopSearch: string;
  setDirectShopSearch: (v: string) => void;
  directSearchResults: DBShop[];
  onSelectShop: (shop: DBShop) => void;
}) {
  // Show prefectures with shops first, then all
  const topAreas = prefecturesWithShops.slice(0, 8);
  const displayAreas = showAllAreas ? allAreas : topAreas.map(p => p.name);
  const shopCounts = new Map(prefecturesWithShops.map(p => [p.name, p.shop_count]));
  const hasSearchQuery = directShopSearch.length > 0;

  return (
    <div>
      <h3 className="text-base font-semibold mb-1">お店を探す</h3>
      <p className="text-sm text-muted-foreground mb-3">
        店舗名で検索、またはエリアから選んでください
      </p>

      {/* Direct shop name search - always visible */}
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="店舗名で検索（例: アロマ、リラク、スパ...）"
          value={directShopSearch}
          onChange={(e) => setDirectShopSearch(e.target.value)}
          className="pl-10 h-11 text-base"
          autoFocus
        />
      </div>

      {/* Search results */}
      {hasSearchQuery && (
        <div className="space-y-1.5 max-h-52 overflow-y-auto mb-2">
          {directSearchResults.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">該当する店舗が見つかりません</p>
          )}
          {directSearchResults.map(shop => (
            <button
              key={shop.id}
              type="button"
              onClick={() => onSelectShop(shop)}
              className="w-full text-left px-4 py-2.5 rounded-lg transition-colors hover:bg-muted border flex items-center justify-between"
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
      )}

      {/* Separator */}
      {!hasSearchQuery && (
        <>
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 border-t" />
            <span className="text-xs text-muted-foreground">または</span>
            <div className="flex-1 border-t" />
          </div>

          {/* Area selection */}
          <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary" />
            エリアから選ぶ
          </h4>

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
              店舗データを準備中です。上の検索をお試しください。
            </p>
          )}
        </>
      )}
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

// Step 11: Guest Registration
function StepRegistration({
  guestForm,
  setGuestForm,
  guestAgreed,
  setGuestAgreed,
  showPassword,
  setShowPassword,
}: {
  guestForm: { nickname: string; email: string; password: string };
  setGuestForm: (form: { nickname: string; email: string; password: string }) => void;
  guestAgreed: boolean;
  setGuestAgreed: (v: boolean) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold mb-1">あと少し! アカウントを作成</h3>
      <p className="text-sm text-muted-foreground mb-4">
        口コミを公開するためにアカウント登録が必要です。30秒で完了します。
      </p>

      <div className="space-y-4">
        <div>
          <Label htmlFor="guest-nickname" className="text-sm font-medium">
            ニックネーム <span className="text-destructive">*</span>
          </Label>
          <div className="relative mt-1">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="guest-nickname"
              placeholder="口コミに表示される名前"
              value={guestForm.nickname}
              onChange={(e) => setGuestForm({ ...guestForm, nickname: e.target.value })}
              className="pl-10"
              autoFocus
            />
          </div>
        </div>

        <div>
          <Label htmlFor="guest-email" className="text-sm font-medium">
            メールアドレス <span className="text-destructive">*</span>
          </Label>
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="guest-email"
              type="email"
              placeholder="example@email.com"
              value={guestForm.email}
              onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="guest-password" className="text-sm font-medium">
            パスワード <span className="text-destructive">*</span>
          </Label>
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="guest-password"
              type={showPassword ? "text" : "password"}
              placeholder="6文字以上"
              value={guestForm.password}
              onChange={(e) => setGuestForm({ ...guestForm, password: e.target.value })}
              className="pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {guestForm.password.length > 0 && guestForm.password.length < 6 && (
            <p className="text-xs text-destructive mt-1">6文字以上で入力してください</p>
          )}
        </div>

        <div className="flex items-start gap-2 pt-2">
          <Checkbox
            id="guest-terms"
            checked={guestAgreed}
            onCheckedChange={(checked) => setGuestAgreed(checked === true)}
          />
          <Label htmlFor="guest-terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
            <Link href="/terms" target="_blank" className="text-primary hover:underline">利用規約</Link>
            {" "}と{" "}
            <Link href="/privacy" target="_blank" className="text-primary hover:underline">プライバシーポリシー</Link>
            {" "}に同意します
          </Label>
        </div>
      </div>

      <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
        <div className="flex items-start gap-2">
          <Gift className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            登録完了後、口コミが承認されると<span className="font-bold">5クレジット</span>獲得!
            他のセラピストの口コミが読めるようになります。
          </p>
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
