"use client";

import React from "react";
import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Check, Sparkles, Crown, Star, Heart, Smile, Flame, Leaf, Search, MapPin, AlertCircle } from "lucide-react";
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
import { therapistTypes, bodyTypes, parameterLabels, mockShops, mockTherapists, areas } from "@/lib/data";

interface ReviewWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedTherapistId?: string;
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

// Area list
const areaList = ["東京", "福岡", "大阪", "名古屋"];
const allAreas = areas.map(a => a.name);

export function ReviewWizardModal({ open, onOpenChange, preselectedTherapistId, memberType = "free", monthlyReviewCount = 0 }: ReviewWizardModalProps) {
  const [step, setStep] = useState(0);
  const [showAllAreas, setShowAllAreas] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [shopSearch, setShopSearch] = useState("");
  const [therapistSearch, setTherapistSearch] = useState("");
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string | null>(preselectedTherapistId || null);
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

  useEffect(() => {
    if (preselectedTherapistId) {
      const therapist = mockTherapists.find(t => t.id === preselectedTherapistId);
      if (therapist) {
        setSelectedTherapistId(preselectedTherapistId);
        setSelectedShopId(therapist.shopId);
        setSelectedArea(therapist.area);
        setStep(3); // Skip to type selection
      }
    }
  }, [preselectedTherapistId]);

  // Filter shops by area and search
  const filteredShops = mockShops.filter(shop =>
    (!selectedArea || shop.area === selectedArea) &&
    (shop.name.toLowerCase().includes(shopSearch.toLowerCase()) ||
     shop.name.includes(shopSearch))
  );

  // Filter therapists by shop and search
  const filteredTherapists = mockTherapists.filter(t =>
    (!selectedShopId || t.shopId === selectedShopId) &&
    (t.name.toLowerCase().includes(therapistSearch.toLowerCase()) ||
     t.name.includes(therapistSearch))
  );

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      setIsComplete(true);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  // Auto-advance when selection is made
  const handleAreaSelect = (area: string) => {
    setSelectedArea(area);
    setSelectedShopId(null);
    setSelectedTherapistId(null);
    setTimeout(() => setStep(1), 300);
  };

  const handleShopSelect = (shopId: string) => {
    setSelectedShopId(shopId);
    setSelectedTherapistId(null);
    setTimeout(() => setStep(2), 300);
  };

  const handleTherapistSelect = (therapistId: string) => {
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
        {!isComplete && (
          <div className="flex gap-1 px-6 pt-4">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i <= step ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        )}

        {/* Step Content */}
        <div className="min-h-[400px] p-6">
          {isComplete ? (
            <CompletionScreen
              onClose={handleClose}
              memberType={memberType}
              monthlyReviewCount={monthlyReviewCount}
            />
          ) : (
            <>
              {step === 0 && (
                <StepArea
                  selectedArea={selectedArea}
                  onSelect={handleAreaSelect}
                  showAllAreas={showAllAreas}
                  setShowAllAreas={setShowAllAreas}
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
              {step + 1} / {TOTAL_STEPS}
            </span>
            <Button onClick={handleNext} disabled={!canProceed()} className="gap-1">
              {step === TOTAL_STEPS - 1 ? "投稿する" : "次へ"}
              {step < TOTAL_STEPS - 1 && <ChevronRight className="h-4 w-4" />}
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
}: {
  selectedArea: string | null;
  onSelect: (area: string) => void;
  showAllAreas: boolean;
  setShowAllAreas: (v: boolean) => void;
}) {
  const displayAreas = showAllAreas ? allAreas : areaList;

  return (
    <div>
      <h3 className="text-base font-semibold mb-1">エリアを選択</h3>
      <p className="text-sm text-muted-foreground mb-4">
        メンズエステのあるエリアを選んでください
      </p>
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
            <span className="font-medium">{area}</span>
          </button>
        ))}
      </div>
      {!showAllAreas && (
        <button
          type="button"
          onClick={() => setShowAllAreas(true)}
          className="w-full mt-4 text-sm text-primary hover:underline"
        >
          他のエリアを表示
        </button>
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
  selectedShopId: string | null;
  onSelect: (shopId: string) => void;
  filteredShops: typeof mockShops;
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
            <span className="font-medium">{shop.name}</span>
            <span className={cn(
              "text-sm",
              selectedShopId === shop.id ? "text-primary-foreground/70" : "text-muted-foreground"
            )}>
              {shop.district}
            </span>
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
  selectedTherapistId: string | null;
  onSelect: (therapistId: string) => void;
  filteredTherapists: typeof mockTherapists;
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
            <Image
              src={t.images[0] || "/placeholder.svg"}
              alt={t.name}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-1.5 text-white">
              <p className="text-xs font-medium truncate">{t.name}</p>
              <p className="text-[10px] opacity-80">({t.age})</p>
            </div>
            {t.reviewCount > 0 && (
              <div className="absolute top-1 right-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full">
                {t.reviewCount}
              </div>
            )}
          </button>
        ))}
      </div>

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
          placeholder="写真より可愛くてびっくり！明るい笑顔で出迎えてくれました。"
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
          placeholder="会話がとても楽しく、施術も丁寧。時間があっという間に過ぎました。技術もしっかりしていてコリがほぐれました。"
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
          placeholder="人気なので予約は早めがおすすめ。土日は特に取りにくいです。"
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

// Completion Screen - tier-specific messages
function CompletionScreen({
  onClose,
  memberType,
  monthlyReviewCount,
}: {
  onClose: () => void;
  memberType: "free" | "standard" | "vip";
  monthlyReviewCount: number;
}) {
  const newCount = monthlyReviewCount + 1;
  const remaining = Math.max(0, 3 - newCount);

  return (
    <div className="text-center py-8">
      <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
        <Check className="h-10 w-10 text-green-600" />
      </div>
      <h3 className="text-xl font-bold mb-2">投稿ありがとうございます！</h3>

      {memberType === "free" && (
        <p className="text-muted-foreground mb-6">
          口コミ閲覧が<span className="text-primary font-bold">3日間</span>解放されました！
        </p>
      )}

      {memberType === "standard" && (
        <div className="mb-6">
          <p className="text-muted-foreground mb-3">
            今月の投稿: <span className="text-primary font-bold">{newCount}/3</span>本
          </p>
          {/* Progress bar */}
          <div className="w-full max-w-xs mx-auto bg-muted rounded-full h-2 mb-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${Math.min(100, (newCount / 3) * 100)}%` }}
            />
          </div>
          {remaining > 0 ? (
            <p className="text-sm text-muted-foreground">
              あと<span className="text-primary font-bold">{remaining}本</span>でVIP機能解放！
            </p>
          ) : (
            <p className="text-sm text-primary font-bold">
              VIP相当の全機能が解放されました！
            </p>
          )}
        </div>
      )}

      {memberType === "vip" && (
        <p className="text-muted-foreground mb-6">
          いつもご利用ありがとうございます！
        </p>
      )}

      <div className="space-y-3">
        <Button onClick={onClose} className="w-full">
          閉じる
        </Button>
        <Button variant="outline" className="w-full bg-transparent">
          続けて投稿する
        </Button>
      </div>
    </div>
  );
}
