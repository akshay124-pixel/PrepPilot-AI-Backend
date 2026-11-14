const { GoogleGenAI, Type } = require("@google/genai")
const { z } = require("zod")


const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})


const questionSchema = z.object({
    question: z.string(),
    intention: z.string(),
    answer: z.string(),
})

const interviewReportSchema = z.object({
    matchScore: z.number().min(0).max(100),
    technicalQuestions: z.array(questionSchema).min(1),
    behavioralQuestions: z.array(questionSchema).min(1),
    skillGaps: z.array(z.object({
        skill: z.string(),
        severity: z.enum([ "low", "medium", "high" ]),
    })),
    preparationPlan: z.array(z.object({
        day: z.number(),
        focus: z.string(),
        tasks: z.array(z.string()),
    })).min(1),
    title: z.string().trim().min(1).optional(),
})

const interviewReportResponseSchema = {
    type: Type.OBJECT,
    properties: {
        matchScore: {
            type: Type.NUMBER,
            description: "A score from 0 to 100 for the candidate's fit for the job.",
        },
        technicalQuestions: {
            type: Type.ARRAY,
            description: "At least five technical interview questions with guidance.",
            items: {
                type: Type.OBJECT,
                properties: {
                    question: { type: Type.STRING },
                    intention: { type: Type.STRING },
                    answer: { type: Type.STRING },
                },
                required: [ "question", "intention", "answer" ],
            },
        },
        behavioralQuestions: {
            type: Type.ARRAY,
            description: "At least five behavioral interview questions with guidance.",
            items: {
                type: Type.OBJECT,
                properties: {
                    question: { type: Type.STRING },
                    intention: { type: Type.STRING },
                    answer: { type: Type.STRING },
                },
                required: [ "question", "intention", "answer" ],
            },
        },
        skillGaps: {
            type: Type.ARRAY,
            description: "Relevant candidate skill gaps; may be empty if none apply.",
            items: {
                type: Type.OBJECT,
                properties: {
                    skill: { type: Type.STRING },
                    severity: {
                        type: Type.STRING,
                        enum: [ "low", "medium", "high" ],
                    },
                },
                required: [ "skill", "severity" ],
            },
        },
        preparationPlan: {
            type: Type.ARRAY,
            description: "A day-by-day preparation plan with at least one day.",
            items: {
                type: Type.OBJECT,
                properties: {
                    day: { type: Type.NUMBER },
                    focus: { type: Type.STRING },
                    tasks: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: [ "day", "focus", "tasks" ],
            },
        },
        title: {
            type: Type.STRING,
            description: "A concise job title.",
        },
    },
    required: [
        "matchScore",
        "technicalQuestions",
        "behavioralQuestions",
        "skillGaps",
        "preparationPlan",
        "title",
    ],
}

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {


    const prompt = `Generate an interview report for a candidate with the following details. Include a concise job title in the title field and never omit it. Return at least five technical questions, five behavioral questions, and one preparation-plan day. Include relevant skill gaps, or an empty list if there are none:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}
`

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: interviewReportResponseSchema,
        }
    })

    return interviewReportSchema.parse(JSON.parse(response.text))


}

const winAnsiSpecialCharacters = new Map([
    [0x20ac, 0x80],
    [0x201a, 0x82],
    [0x0192, 0x83],
    [0x201e, 0x84],
    [0x2026, 0x85],
    [0x2020, 0x86],
    [0x2021, 0x87],
    [0x02c6, 0x88],
    [0x2030, 0x89],
    [0x0160, 0x8a],
    [0x2039, 0x8b],
    [0x0152, 0x8c],
    [0x017d, 0x8e],
    [0x2018, 0x91],
    [0x2019, 0x92],
    [0x201c, 0x93],
    [0x201d, 0x94],
    [0x2022, 0x95],
    [0x2013, 0x96],
    [0x2014, 0x97],
    [0x02dc, 0x98],
    [0x2122, 0x99],
    [0x0161, 0x9a],
    [0x203a, 0x9b],
    [0x0153, 0x9c],
    [0x017e, 0x9e],
    [0x0178, 0x9f],
]);

const escapePdfText = (text) =>
    Array.from(text, (character) => {
        const codePoint = character.codePointAt(0);
        const byte =
            codePoint <= 0x7f || (codePoint >= 0xa0 && codePoint <= 0xff)
                ? codePoint
                : winAnsiSpecialCharacters.get(codePoint) ?? 0x3f;

        if (byte === 0x28 || byte === 0x29 || byte === 0x5c) {
            return `\\${String.fromCharCode(byte)}`;
        }
        if (byte < 0x20 || byte > 0x7e) {
            return `\\${byte.toString(8).padStart(3, "0")}`;
        }
        return String.fromCharCode(byte);
    }).join("");

const resumeSectionHeadings = new Set([
    "profile",
    "summary",
    "professional summary",
    "career objective",
    "objective",
    "experience",
    "work experience",
    "professional experience",
    "employment history",
    "education",
    "skills",
    "technical skills",
    "projects",
    "certifications",
    "achievements",
    "languages",
    "publications",
    "volunteer experience",
    "interests",
    "references",
]);

const wrapResumeText = (text, maxLineLength) => {
    const lines = [];
    for (const paragraph of text.split(/\r?\n/)) {
        const words = paragraph.trim().split(/\s+/).filter(Boolean);
        if (!words.length) {
            lines.push("");
            continue;
        }

        let line = "";
        for (const word of words) {
            let remaining = word;
            while (remaining.length > maxLineLength) {
                if (line) {
                    lines.push(line);
                    line = "";
                }
                lines.push(remaining.slice(0, maxLineLength));
                remaining = remaining.slice(maxLineLength);
            }

            if (line && line.length + remaining.length + 1 > maxLineLength) {
                lines.push(line);
                line = remaining;
            } else {
                line = line ? `${line} ${remaining}` : remaining;
            }
        }
        if (line) {
            lines.push(line);
        }
    }
    return lines;
};

const normalizeKeyword = (value) =>
    ` ${value.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim().replace(/\s+/g, " ")} `;

const getMatchedResumeKeywords = (resume, jobDescription) => {
    if (typeof jobDescription !== "string" || !jobDescription.trim()) {
        return [];
    }

    const lines = resume.split(/\r?\n/);
    const skillsIndex = lines.findIndex((line) =>
        /^\s*(?:technical )?skills(?:\s*:|\s*$)/i.test(line),
    );
    if (skillsIndex === -1) {
        return [];
    }

    const sectionEnd = lines.findIndex(
        (line, index) =>
            index > skillsIndex &&
            resumeSectionHeadings.has(
                line.trim().replace(/:$/, "").toLowerCase(),
            ),
    );
    const inlineSkills = lines[skillsIndex]
        .replace(/^\s*(?:technical )?skills\s*:?\s*/i, "")
        .trim();
    const skillLines = [
        inlineSkills,
        ...lines.slice(
            skillsIndex + 1,
            sectionEnd === -1 ? lines.length : sectionEnd,
        ),
    ];
    const candidates = [];

    for (const line of skillLines) {
        const categorySeparator = line.indexOf(":");
        const skills =
            categorySeparator === -1 ? line : line.slice(categorySeparator + 1);
        for (const skill of skills.split(/[,;|]/)) {
            const phrase = skill.replace(/^[•●▪*-]\s*/, "").trim();
            if (!phrase) {
                continue;
            }

            const withoutParenthetical = phrase.replace(/\s*\([^)]*\)/g, "").trim();
            if (withoutParenthetical) {
                candidates.push(withoutParenthetical);
            }
            candidates.push(phrase);
        }
    }

    const normalizedJobDescription = normalizeKeyword(jobDescription);
    const matchedKeywords = [];
    const seenKeywords = new Set();
    for (const keyword of candidates) {
        const normalizedKeyword = normalizeKeyword(keyword);
        if (
            normalizedKeyword.trim().length < 2 ||
            seenKeywords.has(normalizedKeyword) ||
            !normalizedJobDescription.includes(normalizedKeyword)
        ) {
            continue;
        }
        seenKeywords.add(normalizedKeyword);
        matchedKeywords.push({
            keyword,
            position: normalizedJobDescription.indexOf(normalizedKeyword),
        });
    }

    return matchedKeywords
        .sort((left, right) => left.position - right.position)
        .slice(0, 12)
        .map(({ keyword }) => keyword);
};

const getResumeContent = (resume, matchedKeywords = []) => {
    const sourceLines = resume.split(/\r?\n/);
    for (let index = 1; index < sourceLines.length; index += 1) {
        const previousLine = sourceLines[index - 1].trim();
        const currentLine = sourceLines[index].trim();
        if (/[a-z]-$/i.test(previousLine) && /^[a-z]/.test(currentLine)) {
            sourceLines[index - 1] =
                previousLine.slice(0, -1) + currentLine;
            sourceLines.splice(index, 1);
            index -= 1;
        }
    }

    const nameIndex = sourceLines.findIndex((line) => line.trim());
    const name = sourceLines[nameIndex].trim();
    const firstSectionIndex = sourceLines.findIndex(
        (line, index) =>
            index > nameIndex &&
            resumeSectionHeadings.has(
                line.trim().replace(/:$/, "").toLowerCase(),
            ),
    );
    const contactEnd =
        firstSectionIndex === -1
            ? Math.min(sourceLines.length, nameIndex + 6)
            : firstSectionIndex;
    const contactLineIndices = new Set();
    const contactLines = [];
    const contactLinePattern =
        /@|https?:\/\/|www\.|\b(?:portfolio|github|linkedin)\b|\+?\d[\d ().-]{6,}\d/i;

    for (let index = nameIndex + 1; index < contactEnd; index += 1) {
        const line = sourceLines[index].trim();
        if (contactLinePattern.test(line)) {
            contactLineIndices.add(index);
            contactLines.push(line);
        }
    }

    const content = [];

    for (const [offset, sourceLine] of sourceLines
        .slice(nameIndex + 1)
        .entries()) {
        const sourceIndex = nameIndex + 1 + offset;
        if (contactLineIndices.has(sourceIndex)) {
            continue;
        }

        const line = sourceLine.trim().replace(/[–—]/g, "-");
        if (!line) {
            if (content.length && content[content.length - 1].type !== "space") {
                content.push({ type: "space", text: "" });
            }
            continue;
        }

        const bullet = /^[•●▪*-]\s*/.test(line);
        const text = bullet ? line.replace(/^[•●▪*-]\s*/, "") : line;
        const headingText = text.replace(/:$/, "").toLowerCase();
        const uppercaseHeading =
            text.length <= 48 &&
            /[A-Z]/.test(text) &&
            text === text.toUpperCase() &&
            !/[.!?]$/.test(text);
        const type =
            bullet
                ? "bullet"
                : resumeSectionHeadings.has(headingText) || uppercaseHeading
                  ? "heading"
                  : "text";

        content.push({ type, text });
    }

    if (matchedKeywords.length) {
        const firstBodySectionIndex = content.findIndex(
            (item) => item.type === "heading",
        );
        const summaryIndex = content.findIndex(
            (item) =>
                item.type === "heading" &&
                [
                    "profile",
                    "summary",
                    "professional summary",
                    "career objective",
                    "objective",
                ].includes(item.text.replace(/:$/, "").toLowerCase()),
        );
        const nextSectionAfterSummary =
            summaryIndex === -1
                ? -1
                : content.findIndex(
                    (item, index) =>
                        index > summaryIndex && item.type === "heading",
                );
        const keywordSectionIndex =
            summaryIndex !== -1
                ? nextSectionAfterSummary === -1
                    ? content.length
                    : nextSectionAfterSummary
                : firstBodySectionIndex === -1
                  ? 0
                  : firstBodySectionIndex;
        content.splice(
            keywordSectionIndex,
            0,
            { type: "heading", text: "JOB-MATCHED SKILLS" },
            { type: "keywords", items: matchedKeywords },
            { type: "space", text: "" },
        );
    }

    return { name, contactLines, content };
};

const getResumeRows = (content, fontSize, columnWidth) =>
    content.flatMap((item) => {
        if (item.type === "space") {
            return [{ ...item, height: 4 }];
        }

        if (item.type === "keywords") {
            const chipGap = 5;
            const chipPadding = 14;
            const rows = [];
            let chips = [];
            let rowWidth = 0;

            for (const text of item.items) {
                const width = Math.min(
                    columnWidth,
                    text.length * fontSize * 0.48 + chipPadding,
                );
                if (chips.length && rowWidth + chipGap + width > columnWidth) {
                    rows.push({
                        type: "keyword-chips",
                        chips,
                        height: fontSize + 9,
                    });
                    chips = [];
                    rowWidth = 0;
                }

                chips.push({ text, width });
                rowWidth += (chips.length > 1 ? chipGap : 0) + width;
            }

            if (chips.length) {
                rows.push({
                    type: "keyword-chips",
                    chips,
                    height: fontSize + 9,
                });
            }
            return rows;
        }

        const bulletIndent = item.type === "bullet" ? 12 : 0;
        const maxLineLength = Math.max(
            12,
            Math.floor((columnWidth - bulletIndent) / (fontSize * 0.52)),
        );
        const wrappedLines = wrapResumeText(item.text, maxLineLength);
        const rowHeight =
            item.type === "heading" ? fontSize + 9 : fontSize + 2.5;

        return wrappedLines.map((text, index) => ({
            type: item.type,
            text,
            continuation: index > 0,
            height: rowHeight,
        }));
    });

const splitResumeRows = (rows, maxColumnHeight) => {
    const totalHeight = rows.reduce((total, row) => total + row.height, 0);
    let leftHeight = 0;
    let bestSplit = null;
    let bestDifference = Infinity;

    for (let split = 0; split <= rows.length; split += 1) {
        const rightHeight = totalHeight - leftHeight;
        if (
            (split === 0 || rows[split - 1]?.type !== "heading") &&
            leftHeight <= maxColumnHeight &&
            rightHeight <= maxColumnHeight
        ) {
            const difference = Math.abs(leftHeight - rightHeight);
            if (difference < bestDifference) {
                bestSplit = split;
                bestDifference = difference;
            }
        }
        if (split < rows.length) {
            leftHeight += rows[split].height;
        }
    }

    return bestSplit;
};

const pdfTextOperation = (text, x, y, font, size, color) =>
    `BT /${font} ${size} Tf ${color.join(" ")} rg ${x} ${y} Td ` +
    `(${escapePdfText(text)}) Tj ET`;

async function generateResumePdf({ resume, jobDescription }) {
    if (typeof resume !== "string" || !resume.trim()) {
        throw new Error("Cannot generate a PDF without resume text");
    }

    const matchedKeywords = getMatchedResumeKeywords(resume, jobDescription);
    const { name, contactLines, content } = getResumeContent(
        resume,
        matchedKeywords,
    );
    const pageWidth = 595;
    const margin = 36;
    const columnGap = 24;
    const fullWidth = pageWidth - margin * 2;
    const twoColumnWidth = (fullWidth - columnGap) / 2;
    const contactText = contactLines
        .flatMap((line) =>
            line
                .split(/\s*[—–|•]\s*/)
                .map((item) => item.trim())
                .filter(Boolean),
        )
        .join("  |  ");
    const contactRows = contactText
        ? wrapResumeText(contactText, Math.floor(fullWidth / (8 * 0.52)))
        : [];
    const headerBottom = Math.min(
        732,
        753 - Math.max(0, contactRows.length - 1) * 10,
    );
    const bodyTop = headerBottom - 28;
    const bodyBottom = 42;
    const maxColumnHeight = bodyTop - bodyBottom;
    let fontSize = 10;
    let columns;
    let columnX;

    for (; fontSize >= 4.5; fontSize -= 0.25) {
        const singleColumnRows = getResumeRows(content, fontSize, fullWidth);
        const singleColumnHeight = singleColumnRows.reduce(
            (total, row) => total + row.height,
            0,
        );
        if (singleColumnHeight <= maxColumnHeight) {
            columns = [singleColumnRows];
            columnX = [margin];
            break;
        }

        const twoColumnRows = getResumeRows(content, fontSize, twoColumnWidth);
        const split = splitResumeRows(twoColumnRows, maxColumnHeight);
        if (split !== null) {
            columns = [
                twoColumnRows.slice(0, split),
                twoColumnRows.slice(split),
            ];
            columnX = [margin, margin + twoColumnWidth + columnGap];
            break;
        }
    }

    if (!columns) {
        throw new Error(
            "This resume is too long to fit on one page. Shorten the resume text and try again.",
        );
    }

    const activeColumnWidth = columns.length === 1 ? fullWidth : twoColumnWidth;
    const body = [];
    columns.forEach((column, columnIndex) => {
        let y = bodyTop;
        for (const row of column) {
            if (row.type === "space") {
                y -= row.height;
                continue;
            }

            if (row.type === "keyword-chips") {
                let chipX = columnX[columnIndex];
                const chipHeight = fontSize + 5;
                for (const chip of row.chips) {
                    const chipBottom = y - 3;
                    body.push(
                        `q 0.95 0.97 0.99 rg ${chipX} ${chipBottom} ` +
                        `${chip.width} ${chipHeight} re f Q`,
                    );
                    body.push(
                        `q 0.84 0.89 0.95 RG ${chipX} ${chipBottom} ` +
                        `${chip.width} ${chipHeight} re S Q`,
                    );
                    body.push(
                        pdfTextOperation(
                            chip.text,
                            chipX + 7,
                            y,
                            "F1",
                            Math.max(6, fontSize - 0.5),
                            ["0.12", "0.28", "0.48"],
                        ),
                    );
                    chipX += chip.width + 5;
                }
                y -= row.height;
                continue;
            }

            if (row.type === "heading") {
                y -= 2;
                body.push(
                    pdfTextOperation(row.text, columnX[columnIndex], y, "F2", fontSize + 1, [
                        "0.08",
                        "0.22",
                        "0.38",
                    ]),
                );
                y -= fontSize + 1;
                body.push(
                    `q 1 0.18 0.47 RG ${columnX[columnIndex]} ${y} m ` +
                    `${columnX[columnIndex] + 20} ${y} l S Q`,
                );
                body.push(
                    `q 0.87 0.9 0.94 RG ${columnX[columnIndex] + 25} ${y} m ` +
                    `${columnX[columnIndex] + activeColumnWidth} ${y} l S Q`,
                );
                y -= 6;
                continue;
            }

            if (row.type === "bullet") {
                if (!row.continuation) {
                    body.push(
                        `q 1 0.18 0.47 rg ${columnX[columnIndex] + 2} ` +
                        `${y + fontSize * 0.25} 3 3 re f Q`,
                    );
                }
                body.push(
                    pdfTextOperation(
                        row.text,
                        columnX[columnIndex] + 12,
                        y,
                        "F1",
                        fontSize,
                        ["0.16", "0.2", "0.28"],
                    ),
                );
            } else {
                body.push(
                    pdfTextOperation(
                        row.text,
                        columnX[columnIndex],
                        y,
                        "F1",
                        fontSize,
                        ["0.16", "0.2", "0.28"],
                    ),
                );
            }
            y -= fontSize + 2.5;
        }
    });

    const headerNameFontSize = Math.min(
        26,
        Math.max(16, fullWidth / (name.length * 0.5)),
    );
    const header = [
        `q 0.06 0.12 0.22 rg 0 ${headerBottom} 595 ${842 - headerBottom} re f Q`,
        `q 1 0.18 0.47 rg 0 ${headerBottom} 7 ${842 - headerBottom} re f Q`,
        pdfTextOperation("ATS-READY RESUME", margin, 819, "F2", 8, [
            "0.78",
            "0.84",
            "0.92",
        ]),
        pdfTextOperation(name, margin, 790, "F2", headerNameFontSize, [
            "1",
            "1",
            "1",
        ]),
        ...contactRows.map((line, index) =>
            pdfTextOperation(line, margin, 762 - index * 10, "F1", 8, [
                "0.78",
                "0.84",
                "0.92",
            ]),
        ),
        ...(columns.length > 1
            ? [
                `q 0.87 0.9 0.94 RG 297.5 ${bodyBottom} m ` +
                `297.5 ${bodyTop - 6} l S Q`,
            ]
            : []),
        pdfTextOperation("ATS-READY  •  ONE PAGE", margin, 24, "F1", 8, [
            "0.45",
            "0.5",
            "0.58",
        ]),
    ];
    const pageObjectId = 3;
    const regularFontObjectId = 4;
    const boldFontObjectId = 5;
    const contentObjectId = 6;
    const objectCount = contentObjectId;
    const objects = Array(objectCount + 1);

    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
    objects[pageObjectId] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} 842] ` +
        `/Resources << /Font << /F1 ${regularFontObjectId} 0 R ` +
        `/F2 ${boldFontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
    objects[regularFontObjectId] =
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objects[boldFontObjectId] =
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    const stream = [
        ...header.slice(0, 4),
        ...body,
        ...header.slice(4),
    ].join("\n");
    objects[contentObjectId] =
        `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\n` +
        `stream\n${stream}\nendstream`;

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (let id = 1; id <= objectCount; id += 1) {
        offsets[id] = Buffer.byteLength(pdf, "ascii");
        pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, "ascii");
    pdf += `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
    for (let id = 1; id <= objectCount; id += 1) {
        pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    }
    pdf +=
        `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\n` +
        `startxref\n${xrefOffset}\n%%EOF\n`;

    return Buffer.from(pdf, "ascii");
}

module.exports = { generateInterviewReport, generateResumePdf };