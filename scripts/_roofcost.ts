import { buildRoofCourse } from "@/lib/arcade/rooftop";
const t=performance.now(); buildRoofCourse(12345); console.log("ms", performance.now()-t);
for (const sd of [1,2,3]) { const t=performance.now(); buildRoofCourse(sd); console.log("ms", performance.now()-t); }
