import { buildRoofCourse } from "@/lib/arcade/rooftop";
const t=performance.now(); buildRoofCourse(12345); console.log("ms", performance.now()-t);
