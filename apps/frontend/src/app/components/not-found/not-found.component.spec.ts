import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NotFoundComponent } from './not-found.component';
import { getTranslocoTestingModule } from '../../core/i18n/transloco-testing';

describe('NotFoundComponent', () => {
  it('renders the not-found message with a home link', async () => {
    await TestBed.configureTestingModule({
      imports: [NotFoundComponent, getTranslocoTestingModule()],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('Page not found');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/');
  });
});
