import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class StudentService {
  private apiUrl = 'http://localhost:5000/students';

  constructor(private http: HttpClient) { }

  registerStudent(formData: FormData): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, formData)
      .pipe(
        retry(1),
        catchError(this.handleError)
      );
  }

  getStudentById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  updateStudent(id: string, formData: FormData): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, formData)
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteStudent(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  getAllStudents(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl)
      .pipe(
        catchError(this.handleError)
      );
  }
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