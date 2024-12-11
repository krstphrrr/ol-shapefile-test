import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShapefileUploadComponent } from './shapefile-upload.component';

describe('ShapefileUploadComponent', () => {
  let component: ShapefileUploadComponent;
  let fixture: ComponentFixture<ShapefileUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShapefileUploadComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShapefileUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
