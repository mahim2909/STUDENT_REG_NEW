import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class StudentService {
  // Define API URL directly in the service instead of using environment
  private apiUrl = 'http://localhost:5000/students';
  
  constructor(private http: HttpClient) { }

  /**
   * Register a new student with form data
   * @param formData The form data containing student information and documents
   * @returns Observable with the API response
   */
  registerStudent(formData: FormData): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, formData)
      .pipe(
        retry(1),
        catchError(this.handleError)
      );
  }

  /**
   * Get student details by ID
   * @param id Student ID
   * @returns Observable with student details
   */
  getStudentById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Update student details
   * @param id Student ID
   * @param formData Updated student data
   * @returns Observable with the API response
   */
  updateStudent(id: string, formData: FormData): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, formData)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Delete student record
   * @param id Student ID
   * @returns Observable with the API response
   */
  deleteStudent(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Get all registered students
   * @returns Observable with array of student records
   */
  getAllStudents(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Handle HTTP errors and return user-friendly message
   * @param error The HTTP error response
   * @returns Observable with error message
   */
  private handleError(error: HttpErrorResponse) {
    let errorMessage = '';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      const serverMessage = error.error?.message || 'Unknown server error';
      errorMessage = `Error Code: ${error.status}\nMessage: ${serverMessage}`;
    }
    
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}