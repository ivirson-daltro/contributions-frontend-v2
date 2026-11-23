import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the application shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('restores the saved theme before rendering routes', () => {
    window.localStorage.setItem('ibg.dashboard.theme', 'dark');
    try {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      expect(document.documentElement.classList.contains('dark-theme')).toBe(true);
    } finally {
      window.localStorage.removeItem('ibg.dashboard.theme');
      document.documentElement.classList.remove('dark-theme');
    }
  });

  it('renders the global loading dialog outside the route content', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.global-loading-dialog')).not.toBeNull();
  });
});
