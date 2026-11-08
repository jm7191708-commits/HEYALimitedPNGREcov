import "../env.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url'; // Import fileURLToPath
import * as cheerio from 'cheerio'; // Import cheerio module with namespace import

const __filename = import.meta.url;
const __dirname = path.dirname(fileURLToPath(__filename)); // Get current directory path

const viewsDir = path.join(__dirname, '..', 'views'); // Corrected path: navigate up one level then into 'views'
const knowledgeBaseFile = path.join(__dirname, 'knowledge_base.json');
const businessEmail = String(process.env.BUSINESS_EMAIL || 'admin@heya.com.pg').trim();

const htmlFilePaths = [
    path.join(viewsDir, 'index.ejs'),
    path.join(viewsDir, 'about.ejs'),
    path.join(viewsDir, 'services.ejs'),
    path.join(viewsDir, 'packages.ejs'),
    path.join(viewsDir, 'contact.ejs'),
    path.join(viewsDir, 'advertise.ejs'),
    // Add other relevant EJS files if they exist and contain knowledge
];

function stripHtml(html) {
    const $ = cheerio.load(html);
    return $.text();
}

function prepareTemplateText(fileContent) {
    return fileContent.replace(/<%=\s*businessEmail\s*%>/g, businessEmail);
}

async function generateKnowledgeBase() {
    let allText = '';

    for (const filePath of htmlFilePaths) {
        try {
            const fileContent = prepareTemplateText(fs.readFileSync(filePath, 'utf-8'));
            const cleanedText = stripHtml(fileContent);
            allText += cleanedText + String.fromCharCode(10); // Add newline separators between files
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
        }
    }

    // Basic knowledge base structure - can be expanded
    const knowledgeBase = {
        source_files: htmlFilePaths.map(p => path.basename(p)),
        content: allText.trim()
    };

    try {
        fs.writeFileSync(knowledgeBaseFile, JSON.stringify(knowledgeBase, null, 2), 'utf-8');
        console.log(`Knowledge base generated successfully at ${knowledgeBaseFile}`);
    } catch (error) {
        console.error(`Error writing knowledge base file:`, error);
    }
}

// To run this script, you would typically execute `node scripts/collect_data.js`
// For this automated process, we'll call it directly.
// If 'cheerio' is not installed, it needs to be added to project dependencies.
generateKnowledgeBase();
