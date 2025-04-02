import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-student-details-preview',
  templateUrl: './student-preview-dialog.component.html',
  styleUrls: ['./student-preview-dialog.component.scss']
})
export class StudentPreviewDialogComponent {
  // Base API URL from environment
  private apiBaseUrl = environment.apiUrl;

  constructor(
    public dialogRef: MatDialogRef<StudentPreviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  /**
   * Constructs the full URL for images stored in the uploads folder
   * @param imagePath The image path from the database
   * @returns Complete URL to the image
   */
  getImageUrl(imagePath: string): string {
    if (!imagePath) {
      return '';
    }
    
    // If the path already contains the full URL, return it as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // Remove any leading slash to avoid double slashes
    const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
    
    // Construct full path (assuming uploads is part of your API directory structure)
    return `${this.apiBaseUrl}/uploads/${cleanPath}`;
  }

  printPreview() {
    const printContent = document.querySelector('.print-content'); // Select the preview pop-up
    if (!printContent) {
      console.error("Preview content not found!");
      return;
    }
  
    const printWindow = window.open('', '', 'width=900,height=1000');
  
    if (printWindow) {
      // Copy all styles dynamically
      const styles = Array.from(document.styleSheets)
        .map(sheet => {
          try {
            return Array.from(sheet.cssRules).map(rule => rule.cssText).join('');
          } catch (e) {
            return ''; // Ignore cross-origin errors
          }
        })
        .join('\n');
  
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Preview</title>
            <style>${styles}</style>
          </head>
          <body>
            <div class="print-container">
              ${printContent.outerHTML}  <!-- Capture exact preview content -->
            </div>
            <script>
              window.onload = function() {
                window.print();
                window.close();
              };
            </script>
          </body>
        </html>
      `);
    }
  }
  
  
}