import { useEffect, useState } from "react";
import EarthModel from "./EarthModel.jsx";
import earthModelUrl from "../Assets/Earth_1_12756.glb";

const STARS = [
  [42, 52, 1.1],
  [96, 35, 0.8],
  [172, 92, 1],
  [234, 48, 0.8],
  [388, 78, 0.9],
  [458, 42, 1.2],
  [530, 70, 0.8],
  [605, 42, 1],
  [77, 126, 0.7],
  [563, 132, 0.8]
];

function Spacecraft({ isAnimated }) {
  const spacecraft = (
    <>
      <path
        d="M0 -8 4 -2 12 0 4 2 0 8 -4 2 -12 0 -4 -2Z"
        fill="#f3fbff"
        stroke="#8bd8ff"
        strokeWidth="1.5"
      />
      <path d="M-4 -2 -12 -5 -11 4 -4 2ZM4 -2 12 -5 11 4 4 2Z" fill="#6bb8e8" />
      <circle r="2" fill="#7ee5ff" />
    </>
  );

  if (!isAnimated) {
    return <g transform="translate(320 20)">{spacecraft}</g>;
  }

  return (
    <g>
      <animateMotion dur="18s" repeatCount="indefinite" rotate="auto">
        <mpath href="#orbit-trajectory" />
      </animateMotion>
      {spacecraft}
    </g>
  );
}

export default function OrbitPreview({ isExpanded, onToggle }) {
  const [reduceMotion, setReduceMotion] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [earthLoaded, setEarthLoaded] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReduceMotion(preference.matches);

    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  return (
    <button
      className={`orbit-preview ${
        isExpanded ? "orbit-preview--expanded" : ""
      } ${earthLoaded ? "orbit-preview--earth-loaded" : ""}`}
      type="button"
      onClick={onToggle}
      aria-label={`${isExpanded ? "Collapse" : "Expand"} the orbit preview`}
      aria-expanded={isExpanded}
    >
      <svg
        className="orbit-preview__scene"
        viewBox="0 0 640 280"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="space-background" cx="52%" cy="35%" r="80%">
            <stop offset="0%" stopColor="#10223b" />
            <stop offset="100%" stopColor="#030812" />
          </radialGradient>
          <linearGradient id="earth-ocean" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2b78a5" />
            <stop offset="65%" stopColor="#12416b" />
            <stop offset="100%" stopColor="#081d36" />
          </linearGradient>
          <linearGradient id="earth-atmosphere" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#a4ebff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#4aa5e8" stopOpacity="0" />
          </linearGradient>
          <clipPath id="earth-surface">
            <path d="M0 280 Q320 -150 640 280 L640 320 L0 320Z" />
          </clipPath>
          <path
            id="orbit-trajectory"
            d="M50 170 C90 70 190 18 320 20 C450 18 550 70 590 170"
          />
        </defs>
        <rect width="640" height="280" fill="url(#space-background)" />
        {STARS.map(([cx, cy, radius], index) => (
          <circle
            key={index}
            cx={cx}
            cy={cy}
            r={radius}
            fill="#d9efff"
            opacity="0.75"
          />
        ))}
        <g className="orbit-preview__earth-fallback">
          <path
            d="M0 280 Q320 -150 640 280 L640 320 L0 320Z"
            fill="url(#earth-ocean)"
          />
          <g clipPath="url(#earth-surface)" opacity="0.52">
            <path
              d="M118 216 148 193 174 197 187 177 218 185 229 206 215 224 194 228 179 247 151 244 136 230Z"
              fill="#59a274"
            />
            <path
              d="M370 178 395 167 418 180 437 177 456 197 449 216 427 221 414 241 388 235 380 215 362 201Z"
              fill="#6ba77a"
            />
            <path
              d="M52 258 Q320 198 588 258"
              fill="none"
              stroke="#91c9ef"
              strokeOpacity="0.45"
              strokeWidth="1"
            />
            <path
              d="M88 279 Q320 232 552 279"
              fill="none"
              stroke="#91c9ef"
              strokeOpacity="0.35"
              strokeWidth="1"
            />
          </g>
          <path
            d="M0 280 Q320 -150 640 280"
            fill="none"
            stroke="url(#earth-atmosphere)"
            strokeWidth="7"
          />
        </g>
        <use
          href="#orbit-trajectory"
          fill="none"
          stroke="#8edfff"
          strokeDasharray="4 7"
          strokeLinecap="round"
          strokeOpacity="0.68"
          strokeWidth="1.5"
        />
        <Spacecraft isAnimated={!reduceMotion} />
      </svg>
      <EarthModel
        modelUrl={earthModelUrl}
        isAnimated={!reduceMotion}
        onLoad={() => setEarthLoaded(true)}
      />
      <span className="orbit-preview__label">EARTH ORBIT / 1/4</span>
      <span className="orbit-preview__toggle" aria-hidden="true">
        {isExpanded ? "−" : "+"}
      </span>
      <span className="orbit-preview__caption">
        {isExpanded ? "COLLAPSE VIEW" : "EXPAND VIEW"}
      </span>
    </button>
  );
}
