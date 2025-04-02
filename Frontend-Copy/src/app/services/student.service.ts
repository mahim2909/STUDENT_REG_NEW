import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StudentService {
  private apiUrl = environment.apiUrl + '/api/students';

  constructor(private http: HttpClient) { }

  // Get all students for table display
  getAllStudents(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  // Get student by ID with complete details
  getStudentById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  // Register a new student
  registerStudent(formData: FormData): Observable<any> {
    return this.http.post<any>(this.apiUrl, formData);
  }

  // Update an existing student
  updateStudent(id: string, formData: FormData): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, formData);
  }

  // Delete a student
  deleteStudent(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }

  // Generate URL for static files (photos, signatures, etc.)
  getFileUrl(relativePath: string): string {
    if (!relativePath) return '';
    
    // Make sure we're not duplicating URL structure
    if (relativePath.startsWith('http')) {
      return relativePath;
    }
    
    // Remove any leading slashes from relativePath
    const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    
    return `${environment.apiUrl}/uploads/${cleanPath}`;
  }
}