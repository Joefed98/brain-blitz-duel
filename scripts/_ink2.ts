const { inkReferenceCheck } = await import("@/lib/arcade/inkBridge");
for (const s of [104729, 7, 99991]) { const t = performance.now(); const r = inkReferenceCheck(s); console.log(Math.round(performance.now() - t), r.ok, r.blocks.join(","), r.slides.slice(8)); }
