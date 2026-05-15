import { Parser } from 'json2csv';
// import { jsPDF } from 'jspdf';
// import 'jspdf-autotable';

export function exportToCSV(data: any[], filename: string) {
  try {
    const parser = new Parser();
    const csv = parser.parse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Error exporting CSV:', err);
  }
}

export function exportToPDF(title: string, headers: string[], body: any[][], filename: string) {
  /*
  const doc = new jsPDF();
  doc.text(title, 14, 15);
  (doc as any).autoTable({
    head: [headers],
    body: body,
    startY: 20,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 41, 59] }
  });
  doc.save(`${filename}.pdf`);
  */
  console.log('PDF export temporarily disabled');
}
