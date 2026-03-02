import Link from "next/link";

export default function MockupIndex() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="max-w-lg w-full p-8">
        <h1 className="text-2xl font-bold mb-2">TOP Page Mockups</h1>
        <p className="text-sm text-neutral-500 mb-10">
          3 radically different design directions. Click to compare.
        </p>
        <div className="space-y-5">
          {/* A */}
          <Link
            href="/mockup/a"
            className="block p-6 border-l-4 border-[#c7372f] bg-[#faf8f5] hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-xs font-bold text-[#c7372f] tracking-wider">A</span>
              <h2 className="font-bold text-lg text-[#1a1a1a]" style={{ fontFamily: "serif" }}>
                和モダン Editorial
              </h2>
            </div>
            <p className="text-sm text-neutral-500 leading-relaxed">
              明朝体（Shippori Mincho）。非対称レイアウト、朱色アクセント。
              高級雑誌のような体験。余白と縦書き風アクセント。
            </p>
          </Link>

          {/* B */}
          <Link
            href="/mockup/b"
            className="block p-6 border-l-4 border-[#00f0ff] bg-[#08080f] hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-xs font-bold text-[#00f0ff] tracking-wider">B</span>
              <h2 className="font-bold text-lg text-white" style={{ fontFamily: "monospace" }}>
                Cyber Neon
              </h2>
            </div>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Space Grotesk + JetBrains Mono。ターミナル風UI、ネオンカラー（Cyan/Pink）。
              グリッド背景、アニメーション数値カウンター。情報が脈打つ。
            </p>
          </Link>

          {/* C */}
          <Link
            href="/mockup/c"
            className="block p-6 border-l-4 border-[#ff4400] bg-white hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-xs font-bold text-[#ff4400] tracking-wider">C</span>
              <h2 className="font-bold text-lg text-[#111]">
                Neo-Brutalist
              </h2>
            </div>
            <p className="text-sm text-neutral-500 leading-relaxed">
              Sora + Work Sans。超巨大タイポグラフィ（10vw）、太ボーダー、角張ったブロック。
              タイポグラフィが支配する、余白が贅沢な空間。オレンジ赤アクセント。
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
