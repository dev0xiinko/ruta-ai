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

    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

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
      if (!ctx) return;
      const pts = route.points;

      // Full ghost route
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.strokeStyle = route.color + "22";
      ctx.lineWidth = route.width + 1;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      // Animated glowing segment
      const totalPts = pts.length - 1;
      const trailLength = 0.25;
      const start = Math.max(0, route.progress - trailLength);
      const end = route.progress;

      // sample the trail
      const steps = 30;
      ctx.beginPath();
      for (let s = 0; s <= steps; s++) {
        const t = start + (end - start) * (s / steps);
        const pt = getPointOnRoute(route, t);
        if (s === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      const grad = ctx.createLinearGradient(
        getPointOnRoute(route, start).x, getPointOnRoute(route, start).y,
        getPointOnRoute(route, end).x, getPointOnRoute(route, end).y
      );
      grad.addColorStop(0, route.color + "00");
      grad.addColorStop(1, route.color + "cc");
      ctx.strokeStyle = grad;
      ctx.lineWidth = route.width;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    function drawPin(pin: Pin, time: number) {
      if (!ctx) return;
      const pulse = Math.sin(time * 0.002 + pin.pulse);
      const radius = 6 + pulse * 2;
      const outerRadius = 14 + pulse * 5;

      // Outer pulse ring
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, outerRadius, 0, Math.PI * 2);
      ctx.fillStyle = pin.color + "22";
      ctx.fill();

      // Mid ring
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = pin.color + "44";
      ctx.fill();

      // Solid center dot
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = pin.color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    function drawDot(dot: Dot) {
      if (!ctx) return;
      const route = routes[dot.routeIdx];
      const pt = getPointOnRoute(route, dot.progress);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = route.color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff88";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    let time = 0;
    function draw() {
      ctx.clearRect(0, 0, width, height);
      time++;

      // Grid
      gridLines.forEach((line) => {
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.strokeStyle = "#e2e8f022";
        ctx.lineWidth = 1;
        ctx.stroke();
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
