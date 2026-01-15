import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const data = [
    {
        content: "Example Thread Post",
        scheduled_time: "2026-01-20T12:00:00",
        media_urls: "",
        first_comment: ""
    },
    {
        content: "Thread with Media",
        scheduled_time: "2026-01-21T15:00:00",
        media_urls: "https://example.com/image.jpg",
        first_comment: ""
    },
    {
        content: "Thread with First Comment",
        scheduled_time: "2026-01-22T09:00:00",
        media_urls: "",
        first_comment: "Link in bio!"
    }
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(data);
XLSX.utils.book_append_sheet(wb, ws, "Template");

const outputPath = path.join(__dirname, 'public/templates/template.xlsx');
XLSX.writeFile(wb, outputPath);

console.log(`Created template.xlsx at ${outputPath}`);
