type LabDocument = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
};

const g = globalThis as any;

if (!g.__LAB_DOCUMENTS__) {
  g.__LAB_DOCUMENTS__ = [] as LabDocument[];
}

export function addDocument(doc: LabDocument) {
  g.__LAB_DOCUMENTS__.push(doc);
}

export function getDocuments(): LabDocument[] {
  return g.__LAB_DOCUMENTS__;
}

export function clearDocuments() {
  g.__LAB_DOCUMENTS__ = [];
}
