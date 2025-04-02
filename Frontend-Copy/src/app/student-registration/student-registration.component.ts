import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StudentService } from '../services/student.service';
import { finalize } from 'rxjs/operators';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-student-registration',
  templateUrl: './student-registration.component.html',
  styleUrls: ['./student-registration.component.scss']
})
export class StudentRegistrationComponent implements OnInit {
  registrationForm!: FormGroup;
  isLoading = false;
  registrationComplete = false;

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
    private dp: DatePipe
  ) { }

  ngOnInit(): void {
    this.initializeForm();
    this.setupFormListeners();
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
        phone_number: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]]
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
        photo: [null, Validators.required],
        signature: [null, Validators.required],
        resume: [null, Validators.required]
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
    this.addressDetailsForm.get('sameAsCurrent')?.valueChanges.subscribe(checked => {
      if (checked) {
        this.copyCurrentAddressToPermanent();
      }
    });
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


    this.studentService.registerStudent(formData)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe(
        response => {
          this.formReset()
          this.registrationComplete = true;
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

  // Prepare form data for submission
  private prepareFormData(): FormData {
    const formData = new FormData();
    this.registrationForm.patchValue({
      date_of_birth: this.dp.transform(this.registrationForm.get("date_of_birth")?.value, "yyyy-mm-dd")
    })
    const formValue = this.registrationForm.value;

    // Add basic details
    Object.keys(formValue.basicDetails).forEach(key => {
      formData.append(`basicDetails.${key}`, formValue.basicDetails[key]);
    });

    // Add address details
    Object.keys(formValue.addressDetails).forEach(key => {
      if (key !== 'sameAsCurrent') {
        formData.append(`addressDetails.${key}`, formValue.addressDetails[key]);
      }
    });

    // Add files
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
    const academic10th = formValue.academicDetails;
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

    // Set default values for fixed academic entries
    this.academicDetailsForm.patchValue({
      class10th: '10th',
      class12th: '12th',
      classUG: 'Undergraduate'
    });

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
}