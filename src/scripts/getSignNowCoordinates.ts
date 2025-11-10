import 'dotenv/config';
import { signNowService } from '../services/signNowService';

type CliArgs = {
  documentId?: string;
  templateId?: string;
  full?: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {};
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--document-id=')) out.documentId = arg.split('=')[1];
    else if (arg.startsWith('--template-id=')) out.templateId = arg.split('=')[1];
    else if (arg === '--full') out.full = true;
  }
  return out;
}

async function main() {
  const { documentId, templateId, full } = parseArgs(process.argv);

  if (!documentId && !templateId) {
    console.error('Usage: tsx src/scripts/getSignNowCoordinates.ts --document-id=<id> [--full]');
    console.error('       tsx src/scripts/getSignNowCoordinates.ts --template-id=<id>  (coordinates often unavailable for templates)');
    process.exit(1);
  }

  try {
    if (documentId) {
      const fields = await signNowService.getDocumentFields(documentId);

      const simplified = fields.map((f: any) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        role: f.role,
        page: f.page_number,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
      }));

      if (full) {
        console.log(JSON.stringify(fields, null, 2));
      } else {
        console.table(simplified);
        console.log('\nJSON:');
        console.log(JSON.stringify(simplified, null, 2));
      }
    } else if (templateId) {
      const info = await signNowService.getTemplateFields(templateId);
      console.warn('Note: Template endpoints may not return x/y coordinates. Results below:');
      console.log(JSON.stringify(info, null, 2));
    }
  } catch (err: any) {
    console.error('Failed to fetch coordinates:', err?.message || err);
    if (err?.response?.data) {
      console.error('Response data:', JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();



