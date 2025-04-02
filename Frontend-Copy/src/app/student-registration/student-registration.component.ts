import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { StudentService } from '../services/student.service';
import { finalize, Subscription } from 'rxjs';
import { DatePipe } from '@angular/common';
import { StudentPreviewDialogComponent } from './student-preview-dialog/student-preview-dialog.component';
import { ConfirmationDialogComponent } from './confirmation-dialog.component';

@Component({
  selector: 'app-student-registration',
  templateUrl: './student-registration.component.html',
  styleUrls: ['./student-registration.component.scss']
})
export class StudentRegistrationComponent implements OnInit, OnDestroy {
  registrationForm!: FormGroup;
  isLoading = false;
  isLoadingTable = false;
  registrationComplete = false;
  editMode = false;
  currentStudentId: string | null = null;

  // Table related properties
  students: any[] = [];
  displayedColumns: string[] = ['id', 'name', 'email', 'phone', 'actions'];
  
  // Subscriptions
  private subscriptions: Subscription[] = [];

  // File handling properties
  selectedPhoto: File | null = null;
  selectedSignature: File | null = null;
  selectedResume: File | null = null;
  selectedMarksheet10th: File | null = null;
  selectedMarksheet12th: File | null = null;
  selectedMarksheetUG: File | null = null;
  photoPreview: string | null = null;
  signaturePreview: string | null = null;

  constructor(
    private fb: FormBuilder,
    private studentService: StudentService,
    private snackBar: MatSnackBar,
    private dp: DatePipe,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.initializeForm();
    this.setupFormListeners();
    this.loadStudents();
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // Form getters for easier access in template
  get basicDetailsForm(): FormGroup {
    return this.registrationForm.get('basicDetails') as FormGroup;
  }

  get addressDetailsForm(): FormGroup {
    return this.registrationForm.get('addressDetails') as FormGroup;
  }

  get fileDetailsForm(): FormGroup {
    return this.registrationForm.get('fileDetails') as FormGroup;
  }

  get academicDetailsForm(): FormGroup {
    return this.registrationForm.get('academicDetails') as FormGroup;
  }

  // Initialize main form structure with validation
  private initializeForm(): void {
    this.registrationForm = this.fb.group({
      basicDetails: this.fb.group({
        first_name: ['', [Validators.required, Validators.maxLength(50)]],
        middle_name: ['', Validators.maxLength(50)],
        last_name: ['', [Validators.required, Validators.maxLength(50)]],
        date_of_birth: ['', Validators.required],
        gender: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        phone_number: ['', [Validators.required, Validators.pattern(/^[6-9][0-9]{9}$/)]]
      }),
      addressDetails: this.fb.group({
        current_addressLine: ['', [Validators.required, Validators.maxLength(100)]],
        current_block: ['', [Validators.required, Validators.maxLength(50)]],
        current_dist: ['', [Validators.required, Validators.maxLength(50)]],
        current_state: ['', [Validators.required, Validators.maxLength(50)]],
        current_pincode: ['', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]],
        sameAsCurrent: [false],
        permanent_addressLine: ['', [Validators.required, Validators.maxLength(100)]],
        permanent_block: ['', [Validators.required, Validators.maxLength(50)]],
        permanent_dist: ['', [Validators.required, Validators.maxLength(50)]],
        permanent_state: ['', [Validators.required, Validators.maxLength(50)]],
        permanent_pincode: ['', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]]
      }),
      fileDetails: this.fb.group({
        photo: [null, this.editMode ? null : Validators.required],
        signature: [null, this.editMode ? null : Validators.required],
        resume: [null, this.editMode ? null : Validators.required]
      }),
      academicDetails: this.fb.group({
        // 10th Standard
        class10th: ['10th', Validators.required],
        percent10th: ['', [Validators.required, Validators.min(0), Validators.max(100)]],
        board10th: ['', Validators.required],
        marksheet10th: [null],

        // 12th Standard
        class12th: ['12th', Validators.required],
        percent12th: ['', [Validators.required, Validators.min(0), Validators.max(100)]],
        board12th: ['', Validators.required],
        marksheet12th: [null],

        // Undergraduate
        classUG: ['Undergraduate', Validators.required],
        percentUG: ['', [Validators.required, Validators.min(0), Validators.max(100)]],
        boardUG: ['', Validators.required],
        marksheetUG: [null]
      })
    });
  }

  // Set up listeners for form interactions
  private setupFormListeners(): void {
    // When "sameAsCurrent" is checked, copy current address to permanent address
    const subscription = this.addressDetailsForm.get('sameAsCurrent')?.valueChanges.subscribe(checked => {
      if (checked) {
        this.copyCurrentAddressToPermanent();
      }
    });
    
    if (subscription) {
      this.subscriptions.push(subscription);
    }
  }

  // Copy current address values to permanent address fields
  private copyCurrentAddressToPermanent(): void {
    const addressForm = this.addressDetailsForm;
    addressForm.patchValue({
      permanent_addressLine: addressForm.get('current_addressLine')?.value,
      permanent_block: addressForm.get('current_block')?.value,
      permanent_dist: addressForm.get('current_dist')?.value,
      permanent_state: addressForm.get('current_state')?.value,
      permanent_pincode: addressForm.get('current_pincode')?.value
    });
  }

  // Handle file selection for uploads
  onFileSelected(event: Event, fileType: string): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];

    // Handle file types
    switch (fileType) {
      case 'photo':
        this.selectedPhoto = file;
        this.fileDetailsForm.patchValue({ photo: file });
        this.createImagePreview(file, 'photo');
        break;
      case 'signature':
        this.selectedSignature = file;
        this.fileDetailsForm.patchValue({ signature: file });
        this.createImagePreview(file, 'signature');
        break;
      case 'resume':
        this.selectedResume = file;
        this.fileDetailsForm.patchValue({ resume: file });
        break;
      case 'marksheet-10th':
        this.selectedMarksheet10th = file;
        this.academicDetailsForm.patchValue({ marksheet10th: file });
        break;
      case 'marksheet-12th':
        this.selectedMarksheet12th = file;
        this.academicDetailsForm.patchValue({ marksheet12th: file });
        break;
      case 'marksheet-ug':
        this.selectedMarksheetUG = file;
        this.academicDetailsForm.patchValue({ marksheetUG: file });
        break;
    }
  }

  // Create image previews for photo and signature
  private createImagePreview(file: File, type: string): void {
    const reader = new FileReader();
    reader.onload = () => {
      if (type === 'photo') {
        this.photoPreview = reader.result as string;
      } else if (type === 'signature') {
        this.signaturePreview = reader.result as string;
      }
    };
    reader.readAsDataURL(file);
  }

  // Get file name for display
  getFileName(file: File | null): string {
    return file ? file.name : 'No file chosen';
  }

  // Handle form submission
  onSubmitForm(): void {
    if (this.registrationForm.invalid) {
      this.markFormGroupTouched(this.registrationForm);
      this.snackBar.open('Please fill all required fields correctly.', 'Close', {
        duration: 5000,
        panelClass: 'snackbar-error'
      });
      return;
    }

    this.isLoading = true;
    const formData = this.prepareFormData();

    if (this.editMode && this.currentStudentId) {
      // Update existing student
      this.studentService.updateStudent(this.currentStudentId, formData)
        .pipe(
          finalize(() => {
            this.isLoading = false;
          })
        )
        .subscribe(
          response => {
            this.formReset();
            this.loadStudents();
            this.snackBar.open('Student updated successfully!', 'Close', {
              duration: 5000,
              panelClass: 'snackbar-success'
            });
          },
          error => {
            console.error('Update error:', error);
            this.snackBar.open('Update failed. Please try again.', 'Close', {
              duration: 5000,
              panelClass: 'snackbar-error'
            });
          }
        );
    } else {
      // Register new student
      this.studentService.registerStudent(formData)
        .pipe(
          finalize(() => {
            this.isLoading = false;
          })
        )
        .subscribe(
          response => {
            this.formReset();
            this.registrationComplete = true;
            this.loadStudents();
            this.snackBar.open('Registration successful!', 'Close', {
              duration: 5000,
              panelClass: 'snackbar-success'
            });
            window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
          },
          error => {
            console.error('Registration error:', error);
            this.snackBar.open('Registration failed. Please try again.', 'Close', {
              duration: 5000,
              panelClass: 'snackbar-error'
            });
          }
        );
    }
  }

  // Prepare form data for submission
  private prepareFormData(): FormData {
    const formData = new FormData();
    
    // If in edit mode and we have a student ID, include it
    if (this.editMode && this.currentStudentId) {
      formData.append('student_id', this.currentStudentId);
    }
    
    // Format date of birth
    const dobValue = this.basicDetailsForm.get('date_of_birth')?.value;
    const formattedDob = this.dp.transform(dobValue, 'yyyy-MM-dd');
    
    // Add basic details
    const basicDetails = this.basicDetailsForm.value;
    Object.keys(basicDetails).forEach(key => {
      if (key === 'date_of_birth') {
        formData.append(`basicDetails.${key}`, formattedDob || '');
      } else {
        formData.append(`basicDetails.${key}`, basicDetails[key]);
      }
    });

    // Add address details
    const addressDetails = this.addressDetailsForm.value;
    Object.keys(addressDetails).forEach(key => {
      if (key !== 'sameAsCurrent') {
        formData.append(`addressDetails.${key}`, addressDetails[key]);
      }
    });

    // Add files - only if they are selected
    if (this.selectedPhoto) {
      formData.append('photo', this.selectedPhoto);
    }
    if (this.selectedSignature) {
      formData.append('signature', this.selectedSignature);
    }
    if (this.selectedResume) {
      formData.append('resume', this.selectedResume);
    }

    // Add academic details for 10th
    const academic10th = this.academicDetailsForm.value;
    formData.append('academicDetails[0].class', academic10th.class10th);
    formData.append('academicDetails[0].percent', academic10th.percent10th);
    formData.append('academicDetails[0].board', academic10th.board10th);
    if (this.selectedMarksheet10th) {
      formData.append('marksheet-0', this.selectedMarksheet10th);
    }

    // Add academic details for 12th
    formData.append('academicDetails[1].class', academic10th.class12th);
    formData.append('academicDetails[1].percent', academic10th.percent12th);
    formData.append('academicDetails[1].board', academic10th.board12th);
    if (this.selectedMarksheet12th) {
      formData.append('marksheet-1', this.selectedMarksheet12th);
    }

    // Add academic details for UG
    formData.append('academicDetails[2].class', academic10th.classUG);
    formData.append('academicDetails[2].percent', academic10th.percentUG);
    formData.append('academicDetails[2].board', academic10th.boardUG);
    if (this.selectedMarksheetUG) {
      formData.append('marksheet-2', this.selectedMarksheetUG);
    }

    return formData;
  }

  // Reset the form
  formReset(): void {
    this.registrationForm.reset();
    this.editMode = false;
    this.currentStudentId = null;

    // Set default values for fixed academic entries
    this.academicDetailsForm.patchValue({
      class10th: '10th',
      class12th: '12th',
      classUG: 'Undergraduate'
    });

    // Reset file validation requirements
    this.updateFileValidation(false);

    // Reset file properties
    this.selectedPhoto = null;
    this.selectedSignature = null;
    this.selectedResume = null;
    this.selectedMarksheet10th = null;
    this.selectedMarksheet12th = null;
    this.selectedMarksheetUG = null;
    this.photoPreview = null;
    this.signaturePreview = null;
    this.registrationComplete = false;
  }

  // Update file validation based on edit mode
  private updateFileValidation(isEditMode: boolean): void {
    const photoControl = this.fileDetailsForm.get('photo');
    const signatureControl = this.fileDetailsForm.get('signature');
    const resumeControl = this.fileDetailsForm.get('resume');
    
    if (isEditMode) {
      photoControl?.clearValidators();
      signatureControl?.clearValidators();
      resumeControl?.clearValidators();
    } else {
      photoControl?.setValidators(Validators.required);
      signatureControl?.setValidators(Validators.required);
      resumeControl?.setValidators(Validators.required);
    }
    
    photoControl?.updateValueAndValidity();
    signatureControl?.updateValueAndValidity();
    resumeControl?.updateValueAndValidity();
  }

  // Mark all controls as touched to trigger validation messages
  private markFormGroupTouched(formGroup: FormGroup | FormArray) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);

      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markFormGroupTouched(control);
      } else if (control) {
        control.markAsTouched();
      }
    });
  }

  // Get error message for form controls
  getErrorMessage(control: AbstractControl | null): string {
    if (!control) return '';

    if (control.hasError('required')) {
      return 'This field is required';
    }

    if (control.hasError('email')) {
      return 'Please enter a valid email address';
    }

    if (control.hasError('pattern')) {
      if (control.errors?.['pattern'].requiredPattern === '^[0-9]{10}$') {
        return 'Please enter a valid 10-digit phone number';
      }
      if (control.errors?.['pattern'].requiredPattern === '^[0-9]{6}$') {
        return 'Please enter a valid 6-digit pincode';
      }
      return 'Invalid format';
    }

    if (control.hasError('min')) {
      return `Value should be at least ${control.errors?.['min'].min}`;
    }

    if (control.hasError('max')) {
      return `Value should not exceed ${control.errors?.['max'].max}`;
    }

    if (control.hasError('maxlength')) {
      return `Maximum ${control.errors?.['maxlength'].requiredLength} characters allowed`;
    }

    return 'Field is invalid';
  }

  // Get error message for academic controls
  getAcademicControlError(controlName: string): string {
    const control = this.academicDetailsForm.get(controlName);
    return this.getErrorMessage(control);
  }

  // Load all students for the table
  loadStudents(): void {
    this.isLoadingTable = true;
    
    this.studentService.getAllStudents()
      .pipe(
        finalize(() => {
          this.isLoadingTable = false;
        })
      )
      .subscribe(
        (data) => {
          this.students = data;
        },
        (error) => {
          console.error('Error loading students:', error);
          this.snackBar.open('Failed to load student records', 'Close', {
            duration: 5000,
            panelClass: 'snackbar-error'
          });
        }
      );
  }

  // Preview student details
  previewStudent(student: any): void {
    // First, get complete student details including academics
    this.studentService.getStudentById(student.student_id).subscribe(
      (studentData) => {
        this.dialog.open(StudentPreviewDialogComponent, {
          width: '800px',
          data: studentData
        });
      },
      (error) => {
        console.error('Error fetching student details:', error);
        this.snackBar.open('Failed to load student details', 'Close', {
          duration: 5000,
          panelClass: 'snackbar-error'
        });
      }
    );
  }

  // Edit student (populate form with student data)
  editStudent(student: any): void {
    this.isLoading = true;
    this.editMode = true;
    this.currentStudentId = student.student_id;
    
    // Update file validation since we don't require files when editing
    this.updateFileValidation(true);
    
    this.studentService.getStudentById(student.student_id)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe(
        (studentData) => {
          this.populateFormWithStudentData(studentData);
          
          // Scroll to top to see the form
          window.scrollTo({ top: 0, behavior: 'smooth' });
          
          this.snackBar.open('Edit mode enabled. Update the form and submit to save changes.', 'Close', {
            duration: 5000,
            panelClass: 'snackbar-info'
          });
        },
        (error) => {
          console.error('Error fetching student details for edit:', error);
          this.snackBar.open('Failed to load student details for editing', 'Close', {
            duration: 5000,
            panelClass: 'snackbar-error'
          });
          this.editMode = false;
          this.currentStudentId = null;
        }
      );
  }

  // Populate form with student data
  private populateFormWithStudentData(student: any): void {
    // Basic details
    this.basicDetailsForm.patchValue({
      first_name: student.first_name,
      middle_name: student.middle_name,
      last_name: student.last_name,
      date_of_birth: new Date(student.date_of_birth),
      gender: student.gender,
      email: student.email,
      phone_number: student.phone_number
    });
    
    // Address details
    this.addressDetailsForm.patchValue({
      current_addressLine: student.current_addressLine,
      current_block: student.current_block,
      current_dist: student.current_dist,
      current_state: student.current_state,
      current_pincode: student.current_pincode,
      permanent_addressLine: student.permanent_addressLine,
      permanent_block: student.permanent_block,
      permanent_dist: student.permanent_dist,
      permanent_state: student.permanent_state,
      permanent_pincode: student.permanent_pincode
    });
    
    // Check if permanent address is same as current address
    const sameAsCurrent = 
      student.current_addressLine === student.permanent_addressLine &&
      student.current_block === student.permanent_block &&
      student.current_dist === student.permanent_dist &&
      student.current_state === student.permanent_state &&
      student.current_pincode === student.permanent_pincode;
      
    this.addressDetailsForm.patchValue({ sameAsCurrent: sameAsCurrent });
    
    // Academic details - find by class name
    if (student.academics && student.academics.length > 0) {
      // Find and set 10th class details
      const class10th = student.academics.find((a: any) => a.class === '10th');
      if (class10th) {
        this.academicDetailsForm.patchValue({
          percent10th: class10th.percent,
          board10th: class10th.board
        });
      }
      
      // Find and set 12th class details
      const class12th = student.academics.find((a: any) => a.class === '12th');
      if (class12th) {
        this.academicDetailsForm.patchValue({
          percent12th: class12th.percent,
          board12th: class12th.board
        });
      }
      
      // Find and set UG class details
      const classUG = student.academics.find((a: any) => a.class === 'Undergraduate');
      if (classUG) {
        this.academicDetailsForm.patchValue({
          percentUG: classUG.percent,
          boardUG: classUG.board
        });
      }
    }
    
    // Set image previews if available
    if (student.photo) {
      this.photoPreview = student.photo.startsWith('http') ? student.photo : this.studentService.getFileUrl(student.photo);
    }
    
    if (student.signature) {
      this.signaturePreview = student.signature.startsWith('http') ? student.signature : this.studentService.getFileUrl(student.signature);
    }
  }

  // Confirm deletion of student
  confirmDelete(student: any): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: 'Confirm Deletion',
        message: `Are you sure you want to delete ${student.first_name} ${student.last_name}'s record? This action cannot be undone.`
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.deleteStudent(student.student_id);
      }
    });
  }

  // Delete student record
  deleteStudent(studentId: string): void {
    this.studentService.deleteStudent(studentId)
      .subscribe(
        () => {
          this.loadStudents();
          this.snackBar.open('Student record deleted successfully', 'Close', {
            duration: 5000,
            panelClass: 'snackbar-success'
          });
        },
        (error) => {
          console.error('Error deleting student:', error);
          this.snackBar.open('Failed to delete student record', 'Close', {
            duration: 5000,
            panelClass: 'snackbar-error'
          });
        }
      );
  }
}