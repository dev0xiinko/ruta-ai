"use client";

import { useEffect, useRef } from "react";

interface Point {
  x: number;
  y: number;
}

interface Route {
  points: Point[];
  color: string;
  progress: number;
  speed: number;
  width: number;
}

interface Pin {
  x: number;
  y: number;
  pulse: number;
  label: string;
  color: string;
}

export function MapCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const canvasCtx = ctx;

    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvasCtx.scale(dpr, dpr);

    // OSM-inspired grid lines
    const gridLines: { x1: number; y1: number; x2: number; y2: number; horiz: boolean }[] = [];
    const gridSpacing = 52;
    for (let x = 0; x < width; x += gridSpacing) {
      gridLines.push({ x1: x, y1: 0, x2: x, y2: height, horiz: false });
    }
    for (let y = 0; y < height; y += gridSpacing) {
      gridLines.push({ x1: 0, y1: y, x2: width, y2: y, horiz: true });
    }

    // Jeepney routes - styled after real Cebu jeepney paths
    const routes: Route[] = [
      {
        points: [
          { x: width * 0.05, y: height * 0.3 },
          { x: width * 0.22, y: height * 0.2 },
          { x: width * 0.38, y: height * 0.35 },
          { x: width * 0.55, y: height * 0.25 },
          { x: width * 0.72, y: height * 0.4 },
          { x: width * 0.9, y: height * 0.3 },
        ],
        color: "#3b82f6",
        progress: 0,
        speed: 0.003,
        width: 2.5,
      },
      {
        points: [
          { x: width * 0.1, y: height * 0.7 },
          { x: width * 0.28, y: height * 0.55 },
          { x: width * 0.45, y: height * 0.65 },
          { x: width * 0.6, y: height * 0.5 },
          { x: width * 0.78, y: height * 0.6 },
          { x: width * 0.95, y: height * 0.55 },
        ],
        color: "#14b8a6",
        progress: 0.3,
        speed: 0.002,
        width: 2.5,
      },
      {
        points: [
          { x: width * 0.15, y: height * 0.05 },
          { x: width * 0.3, y: height * 0.45 },
          { x: width * 0.42, y: height * 0.55 },
          { x: width * 0.5, y: height * 0.85 },
          { x: width * 0.6, y: height * 0.95 },
        ],
        color: "#6366f1",
        progress: 0.6,
        speed: 0.0025,
        width: 2,
      },
      {
        points: [
          { x: width * 0.55, y: height * 0.1 },
          { x: width * 0.65, y: height * 0.35 },
          { x: width * 0.7, y: height * 0.6 },
          { x: width * 0.75, y: height * 0.85 },
        ],
        color: "#3b82f6",
        progress: 0.15,
        speed: 0.0018,
        width: 1.5,
      },
    ];

    const pins: Pin[] = [
      { x: width * 0.38, y: height * 0.35, pulse: 0, label: "IT Park", color: "#3b82f6" },
      { x: width * 0.28, y: height * 0.55, pulse: Math.PI * 0.5, label: "Colon", color: "#14b8a6" },
      { x: width * 0.72, y: height * 0.4, pulse: Math.PI, label: "SM City", color: "#3b82f6" },
      { x: width * 0.5, y: height * 0.65, pulse: Math.PI * 1.5, label: "Carbon", color: "#14b8a6" },
      { x: width * 0.15, y: height * 0.05, pulse: Math.PI * 0.75, label: "Talamban", color: "#6366f1" },
    ];

    // Moving dots along routes
    interface Dot {
      routeIdx: number;
      progress: number;
      speed: number;
    }
    const dots: Dot[] = routes.flatMap((_, i) => [
      { routeIdx: i, progress: Math.random(), speed: 0.001 + Math.random() * 0.002 },
      { routeIdx: i, progress: Math.random(), speed: 0.001 + Math.random() * 0.002 },
    ]);

    function getPointOnRoute(route: Route, t: number): Point {
      const pts = route.points;
      const total = pts.length - 1;
      const seg = Math.min(Math.floor(t * total), total - 1);
      const segT = (t * total) - seg;
      const a = pts[seg];
      const b = pts[seg + 1];
      return {
        x: a.x + (b.x - a.x) * segT,
        y: a.y + (b.y - a.y) * segT,
      };
    }

    function drawRoute(route: Route) {
      const pts = route.points;

      // Full ghost route
      canvasCtx.beginPath();
      canvasCtx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        canvasCtx.lineTo(pts[i].x, pts[i].y);
      }
      canvasCtx.strokeStyle = route.color + "22";
      canvasCtx.lineWidth = route.width + 1;
      canvasCtx.lineCap = "round";
      canvasCtx.lineJoin = "round";
      canvasCtx.stroke();

      // Animated glowing segment
      const trailLength = 0.25;
      const start = Math.max(0, route.progress - trailLength);
      const end = route.progress;

      // sample the trail
      const steps = 30;
      canvasCtx.beginPath();
      for (let s = 0; s <= steps; s++) {
        const t = start + (end - start) * (s / steps);
        const pt = getPointOnRoute(route, t);
        if (s === 0) canvasCtx.moveTo(pt.x, pt.y);
        else canvasCtx.lineTo(pt.x, pt.y);
      }
      const grad = canvasCtx.createLinearGradient(
        getPointOnRoute(route, start).x, getPointOnRoute(route, start).y,
        getPointOnRoute(route, end).x, getPointOnRoute(route, end).y
      );
      grad.addColorStop(0, route.color + "00");
      grad.addColorStop(1, route.color + "cc");
      canvasCtx.strokeStyle = grad;
      canvasCtx.lineWidth = route.width;
      canvasCtx.lineCap = "round";
      canvasCtx.stroke();
    }

    function drawPin(pin: Pin, time: number) {
      const pulse = Math.sin(time * 0.002 + pin.pulse);
      const radius = 6 + pulse * 2;
      const outerRadius = 14 + pulse * 5;

      // Outer pulse ring
      canvasCtx.beginPath();
      canvasCtx.arc(pin.x, pin.y, outerRadius, 0, Math.PI * 2);
      canvasCtx.fillStyle = pin.color + "22";
      canvasCtx.fill();

      // Mid ring
      canvasCtx.beginPath();
      canvasCtx.arc(pin.x, pin.y, radius, 0, Math.PI * 2);
      canvasCtx.fillStyle = pin.color + "44";
      canvasCtx.fill();

      // Solid center dot
      canvasCtx.beginPath();
      canvasCtx.arc(pin.x, pin.y, 5, 0, Math.PI * 2);
      canvasCtx.fillStyle = pin.color;
      canvasCtx.fill();
      canvasCtx.strokeStyle = "#ffffff";
      canvasCtx.lineWidth = 1.5;
      canvasCtx.stroke();
    }

    function drawDot(dot: Dot) {
      const route = routes[dot.routeIdx];
      const pt = getPointOnRoute(route, dot.progress);
      canvasCtx.beginPath();
      canvasCtx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      canvasCtx.fillStyle = route.color;
      canvasCtx.fill();
      canvasCtx.strokeStyle = "#ffffff88";
      canvasCtx.lineWidth = 1.5;
      canvasCtx.stroke();
    }

    let time = 0;
    function draw() {
      canvasCtx.clearRect(0, 0, width, height);
      time++;

      // Grid
      gridLines.forEach((line) => {
        canvasCtx.beginPath();
        canvasCtx.moveTo(line.x1, line.y1);
        canvasCtx.lineTo(line.x2, line.y2);
        canvasCtx.strokeStyle = "#e2e8f022";
        canvasCtx.lineWidth = 1;
        canvasCtx.stroke();
      });

      // Routes
      routes.forEach((route) => {
        route.progress += route.speed;
        if (route.progress > 1) route.progress = 0;
        drawRoute(route);
      });

      // Moving dots
      dots.forEach((dot) => {
        dot.progress += dot.speed;
        if (dot.progress > 1) dot.progress = 0;
        drawDot(dot);
      });

      // Pins
      pins.forEach((pin) => drawPin(pin, time));

      animFrameRef.current = requestAnimationFrame(draw);
    }

    draw();

    const handleResize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    />
  );
}
