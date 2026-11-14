const {
  generateInterviewReport: generateInterviewReportWithAI,
  generateResumePdf: renderResumePdf,
} = require("../services/ai.service");
const mongoose = require("mongoose");
const interviewReportModel = require("../schema/aischema");
const pdfParse = require("pdf-parse");

const generateInterviewReport = async (req, res) => {
  const resumeContent = await new pdfParse.PDFParse(
    Uint8Array.from(req.file.buffer),
  ).getText();
  const { selfDescription, jobDescription } = req.body;

  const interViewReportByAi = await generateInterviewReportWithAI({
    resume: resumeContent.text,
    selfDescription,
    jobDescription,
  });

  const generatedTitle =
    typeof interViewReportByAi.title === "string" &&
    interViewReportByAi.title.trim()
      ? interViewReportByAi.title.trim()
      : jobDescription
          ?.split(/\r?\n/)
          .map((line) => line.trim())
          .find(Boolean)
          ?.slice(0, 120);

  if (!generatedTitle) {
    return res.status(422).json({
      message: "Add the job title to the job description and try again.",
    });
  }

  if (!interViewReportByAi.title?.trim()) {
    console.warn(
      "AI report did not include a title; using the first job-description line.",
    );
  }

  const interviewReport = await interviewReportModel.create({
    user: req.user.id,
    resume: resumeContent.text,
    resumePdf: req.file.buffer,
    selfDescription,
    jobDescription,
    ...interViewReportByAi,
    title: generatedTitle,
  });
  const reportResponse = interviewReport.toObject();
  delete reportResponse.resumePdf;

  res.status(201).json({
    message: "Interview report generated successfully.",
    interviewReport: reportResponse,
  });
};

const getreport = async (req, res) => {
  try {
    const reportId = req.params.id;
    const interviewReport = await interviewReportModel.findById(reportId);
    res.status(200).json({
      interviewReport,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "An error occurred while fetching the interview report.",
    });
  }
};

const getAllreport = async (req, res) => {
  try {
    const userId = req.user.id;
    const interviewReports = await interviewReportModel.find({ user: userId });
    res.status(200).json({
      interviewReports,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "An error occurred while fetching the interview reports.",
    });
  }
};

const deleteInterviewReport = async (req, res) => {
  try {
    const { interviewReportId } = req.params;
    if (!mongoose.isValidObjectId(interviewReportId)) {
      return res.status(404).json({ message: "Interview plan not found." });
    }

    const deletedReport = await interviewReportModel.findOneAndDelete({
      _id: interviewReportId,
      user: req.user.id,
    });

    if (!deletedReport) {
      return res.status(404).json({ message: "Interview plan not found." });
    }

    return res.status(200).json({
      message: "Interview plan deleted successfully.",
      interviewReportId,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "An error occurred while deleting the interview plan.",
    });
  }
};

const generateResumePdf = async (req, res) => {
  const { interviewReportId } = req.params;

  const interviewReport =
    await interviewReportModel.findById(interviewReportId);

  if (!interviewReport) {
    return res.status(404).json({
      message: "Interview report not found.",
    });
  }

  if (
    !interviewReport.user ||
    interviewReport.user.toString() !== req.user.id.toString()
  ) {
    return res.status(404).json({
      message: "Interview report not found.",
    });
  }

  const { resume, jobDescription } = interviewReport;

  const pdfBuffer = await renderResumePdf({ resume, jobDescription });

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`,
  });

  res.send(pdfBuffer);
};

const downloadOriginalResume = async (req, res) => {
  const interviewReport = await interviewReportModel
    .findById(req.params.interviewReportId)
    .select("+resumePdf");

  if (!interviewReport) {
    return res.status(404).json({
      message: "Interview report not found.",
    });
  }

  if (
    !interviewReport.user ||
    interviewReport.user.toString() !== req.user.id.toString()
  ) {
    return res.status(404).json({
      message: "Interview report not found.",
    });
  }

  if (!interviewReport.resumePdf) {
    return res.status(404).json({
      message: "The original CV is unavailable for this older report. Upload it again to download the exact original file.",
    });
  }

  res.type("application/pdf");
  res.attachment("original-cv.pdf");
  res.send(interviewReport.resumePdf);
};

module.exports = {
  generateInterviewReport,
  getreport,
  getAllreport,
  deleteInterviewReport,
  generateResumePdf,
  downloadOriginalResume,
};
