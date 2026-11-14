const express = require("express");
const router = express.Router();
const {
  getreport,
  getAllreport,
  deleteInterviewReport,
  generateInterviewReport,
  generateResumePdf,
  downloadOriginalResume,
} = require("../controller/Logic");
const middleware = require("../middleware/middleware");
const upload = require("../middleware/Multer");
router.post(
  "/interview-report",
  middleware,
  upload.single("resume"),
  generateInterviewReport,
);
router.get("/interview-report/:id", middleware, getreport);
router.delete(
  "/interview-report/:interviewReportId",
  middleware,
  deleteInterviewReport,
);
router.get("/interview-reports", middleware, getAllreport);
router.get(
  "/interview/resume/original/:interviewReportId",
  middleware,
  downloadOriginalResume,
);
router.get(
  "/interview/resume/pdf/:interviewReportId",
  middleware,
  generateResumePdf,
);
module.exports = router;
