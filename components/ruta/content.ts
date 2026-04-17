import {
  Bot,
  Clock3,
  GitBranch,
  Map,
  MapPinned,
  Route,
  Sparkles,
  Wallet,
} from "lucide-react";

export const routeCodes = ["17B", "13C", "04B", "01A", "06D", "12L"];

export const heroHighlights = [
  {
    title: "Decode unfamiliar jeepney codes",
    description: "Turn route labels into actual places, directions, and transfer advice.",
    icon: Sparkles,
  },
  {
    title: "Compare route options quickly",
    description: "See the fastest ride, the cheapest fallback, and where transfers happen.",
    icon: Route,
  },
  {
    title: "Commute with more confidence",
    description: "Know what to ride before you leave instead of guessing at the curb.",
    icon: MapPinned,
  },
];

export const productStats = [
  { label: "Popular route codes covered", value: "50+" },
  { label: "Typical plan shown in seconds", value: "<10s" },
  { label: "Clear transfer guidance", value: "Step-by-step" },
];

export const processSteps = [
  {
    title: "Ask like a commuter",
    description: "Use everyday questions like “IT Park to Colon” or a code like “17B.”",
    icon: Bot,
  },
  {
    title: "RUTA interprets the route",
    description: "It maps the corridor, recognizes transfer points, and narrows the best ride options.",
    icon: Map,
  },
  {
    title: "Choose the best trip",
    description: "Compare fares, timing, and transfer counts without decoding the network yourself.",
    icon: GitBranch,
  },
];

export const routeSummary = {
  prompt: "How do I get from IT Park to Colon?",
  best: {
    label: "Best Direct Route",
    badge: "Recommended",
    jeepney: "Ride 17B, 17C, or 17D from the IT Park / Apas side",
    transfer: "Stay on until Metro Colon / Colonnade / Colon area",
    fare: "PHP 13-15+",
    time: "Direct ride",
    transfers: "0",
    confidence: "Strong match",
    steps: [
      "Go to the jeep loading area for 17B, 17C, or 17D near IT Park / Apas.",
      "Ride any of those routes bound for Carbon or Colon.",
      "No Ayala transfer is needed for this trip.",
      "Get off at Metro Colon, Colonnade, or the Colon area.",
    ],
  },
  alternative: {
    label: "Fare Guidance",
    badge: "Reference",
    jeepney: "Traditional jeep minimum starts at PHP 13",
    fare: "Modern jeep minimum starts at PHP 15",
    time: "Varies by traffic",
    transfers: 0,
    steps: [
      "Exact fare can vary by vehicle type and travel distance.",
      "Route sites note that fares and schedules may change.",
      "Use PHP 13 to PHP 15+ as a practical rider-facing estimate.",
    ],
  },
};

export const trustPoints = [
  { label: "Clear fares", value: "Budget before you ride", icon: Wallet },
  { label: "Travel time", value: "Spot slower fallback routes", icon: Clock3 },
  { label: "Transfer count", value: "Avoid confusing handoffs", icon: GitBranch },
];
