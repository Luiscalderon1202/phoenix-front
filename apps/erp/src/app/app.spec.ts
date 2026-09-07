import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideErpHttp } from '@phoenix/shared/http';
import { provideAuth } from '@phoenix/shared/auth';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideErpHttp({ baseUrl: '/api' }), provideAuth()],
    }).compileComponents();
  });

  it('should create the shell', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
