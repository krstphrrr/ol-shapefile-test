import { Component, Input } from '@angular/core';
import { Map } from 'ol';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';

import { FeatureLike } from 'ol/Feature';
import JSZip from 'jszip';
import { MatDialog } from '@angular/material/dialog'; 
import { ErrorDialogComponent } from '../error-dialog/error-dialog.component';
import * as shapefile from 'shapefile'

@Component({
  selector: 'app-shapefile-upload',
  templateUrl: './shapefile-upload.component.html',
  styleUrls: ['./shapefile-upload.component.scss'],
})
export class ShapefileUploadComponent {
  /* 
  zip or shp file is selected
  depending on file extension, either handlezipshapefile or handlesingleshapefile is triggered

  - handlezipshapefile: checks accompanying files for crs clues 
  - handlesingleshapefile: checks geojson properties for crs clues 

  both of them ultimately execute addlayer with the necessary geojson(featurecollection) and projection

  added toggle just as a test
  + has number of files check
  + has the required files (per zip) check
  + has extent/crs handling check
  
  - missing recursive check
  - missing 'no shapefile' present check
  
  */
  @Input() map!: Map;
  shapefileLayer!: VectorLayer<any>; 

  isLayerVisible = false;

  constructor(private dialog: MatDialog){}

  // error modal
  showError(message: string): void {
    this.dialog.open(ErrorDialogComponent, {
      data: { message },
    });
  }

  // .shp or .zip file selected
  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      // detect if the file is a ZIP archive
      if (file.name.endsWith('.zip')) {
        await this.handleZipShapefile(file);
      } else {
        await this.handleSingleShapefile(file);
      }
    }
  }

  async handleZipShapefile(file: File): Promise<void> {
    try {
      const zip = await JSZip.loadAsync(file);
      const shpFiles = Object.keys(zip.files).filter((name) => name.endsWith('.shp'));
      const dbfFiles = Object.keys(zip.files).filter((name) => name.endsWith('.dbf'));
      const prjFiles = Object.keys(zip.files).filter((name) => name.endsWith('.prj'));
  
      if (shpFiles.length !== 1) {
        this.showError('The ZIP file must contain exactly one .shp file.');
        return;
      }
  
      const shpArrayBuffer = await zip.files[shpFiles[0]].async('arraybuffer');
      const dbfArrayBuffer = await zip.files[dbfFiles[0]].async('arraybuffer');
  
      let projection = 'EPSG:4326';
      if (prjFiles.length === 1) {
        const prjContent = await zip.files[prjFiles[0]].async('string');
        // console.log(prjContent)
        projection = this.parseProjection(prjContent) || projection; 
      } else {
        console.warn('No .prj file found. Using default projection EPSG:4326.');
      }

      const geojson = await shapefile.read(shpArrayBuffer, dbfArrayBuffer);



      if (!geojson.features || geojson.features.length === 0) {
        this.showError('The shapefile contains no valid features.');
        return;
      }
  
      this.addShapefileLayer(geojson, projection);
    } catch (error) {
      console.error('Error handling ZIP shapefile:', error);
      this.showError('An error occurred while processing the shapefile.');
    }
  }
  
  parseProjection(prjContent: string): string | null {
    // parse .prj content and return an EPSG code or null if unknown
    if (prjContent.includes('WGS_1984_UTM_Zone_13N')) return 'EPSG:32613' // jer shapefile 

    return null;
  }



  async handleSingleShapefile(file: File): Promise<void> {
    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const arrayBuffer = e.target.result;
  
      try {
        const geojson = await shapefile.read(arrayBuffer);

        const projection = this.detectProjection(geojson) || 'EPSG:4326'; // using the detect method due to  it  being standalone ( no prj potentially)
        
  
        this.addShapefileLayer(geojson, projection);
      } catch (error) {
        console.error('Error reading shapefile:', error);
        this.showError('An error occurred while processing the shapefile.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  detectProjection(geojson: any): string | null {
    // for single unzipped files 
    console.log(geojson)
    if (geojson.crs && geojson.crs.properties && geojson.crs.properties.name) {
      const crsName = geojson.crs.properties.name;
      console.log(crsName)
      if (crsName.includes('EPSG:4326')) return 'EPSG:4326'; 
      if (crsName.includes('WGS_1984_UTM_Zone_13N')) return 'EPSG:32613';
    }
  
    
    console.warn('No CRS metadata found in GeoJSON. Defaulting to EPSG:4326.');
    return null;
  }

  addShapefileLayer(geojson: any, projection: string): void {
    const source = new VectorSource<FeatureLike>({
      features: new GeoJSON().readFeatures(geojson, {
        dataProjection: projection,
        featureProjection: 'EPSG:3857', 
      }),
    });
  
    this.shapefileLayer = new VectorLayer({
      source: source,
    });
  
    this.map.addLayer(this.shapefileLayer);
  
    const extent = source.getExtent();
    if (extent && extent[0] !== Infinity) {
      this.map.getView().fit(extent, { duration: 1000 });
    } else {
      this.showError('Failed to calculate the extent of the shapefile. Check the CRS.');
    }
  }

  toggleLayer(): void {
    if (this.shapefileLayer) {
      this.isLayerVisible = !this.isLayerVisible;
      this.shapefileLayer.setVisible(this.isLayerVisible);
    }
  }
}
