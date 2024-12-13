import { Component, Input } from '@angular/core';
import { Map } from 'ol';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import { FeatureLike } from 'ol/Feature';
import JSZip from 'jszip';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialogComponent } from '../error-dialog/error-dialog.component';
import * as shapefile from 'shapefile';
import shp from 'shpjs';

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
  
  - missing recursive check, but it is handled
  - missing 'no shapefile' present check
  
  */
  @Input() map!: Map;
  shapefileLayer!: VectorLayer<any>;
  isLayerVisible = false;
  statusMessage = 'Ready to upload shapefile.';

  constructor(private dialog: MatDialog){}

  // error modal
  showError(message: string): void {
    this.dialog.open(ErrorDialogComponent, {
      data: { message },
    });
  }

  setStatus(message: string): void {
    this.statusMessage = message;
  }

  // .shp or .zip file selected
  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.setStatus(`File selected: ${file.name}`);
      if (file.name.endsWith('.zip')) {
        this.setStatus('ZIP file detected. Processing...');
        await this.handleZipShapefile(file);
      } else {
        this.setStatus('Single shapefile detected. Processing...');
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

      // Validate presence of crucial components
      if (shpFiles.length === 0) {
        this.showError('The ZIP file is missing a .shp file. A valid shapefile requires this component.');
        this.setStatus("Zip processing halted.")
        return;
      }

      if (dbfFiles.length === 0) {
        this.showError('The ZIP file is missing a .dbf file. A valid shapefile requires this component.');
        this.setStatus("Zip processing halted.")
        return;
      }

      if (shpFiles.length !== 1) {
        this.showError('The ZIP file must contain exactly one .shp file.');
        this.setStatus("Zip processing halted.")
        return;
      }

      const arrayBuffer = await file.arrayBuffer();

      let projection = 'EPSG:4326';
      if (prjFiles.length === 1) {
        const prjContent = await zip.files[prjFiles[0]].async('string');
        projection = this.parseProjection(prjContent) || projection;
      }

      console.log(projection)
      this.setStatus('Parsing shapefile...');
    
      
      const geojson = await shp(arrayBuffer);

      const featureCollections = Array.isArray(geojson) ? geojson : [geojson];

      let isValid = false;

      for (const featureCollection of featureCollections) {
        if (featureCollection.features && featureCollection.features.length > 0) {
          isValid = true;
          this.addShapefileLayer(featureCollection, projection);
        }
      }

      if (!isValid) {
        this.showError('The shapefile contains no valid features.');
        return;
      }

      this.setStatus('Shapefile loaded successfully.');
    } catch (error) {
      console.error('Error handling ZIP shapefile:', error);
      this.showError('An error occurred while processing the shapefile.');
    }
  }
  
  parseProjection(prjContent: string): string | null {
    // parse .prj content and return an EPSG code or null if unknown
    // look into difference between libraries
    // if (prjContent.includes('WGS_1984_UTM_Zone_13N')) return 'EPSG:32613' // jer shapefile with shapefile library
    if (prjContent.includes('WGS_1984_UTM_Zone_13N')) return 'EPSG:4326'// jer shapefile with shpjs library 


    return null;
  }



  async handleSingleShapefile(file: File): Promise<void> {
    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const arrayBuffer = e.target.result;
      try {

        this.setStatus('Parsing shapefile...');

        // using shapefile, shpjs expects a zip
        const geojson = await shapefile.read(arrayBuffer);
        const projection = this.detectProjection(geojson) || 'EPSG:4326';

        
        this.addShapefileLayer(geojson, projection);
        
        this.setStatus('Shapefile loaded successfully.');
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
      style: new Style({
        fill: new Fill({ color: 'rgba(255, 0, 0, 0.5)' }),
        stroke: new Stroke({ color: 'red', width: 2 }),
      }),
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

  clearLayer(): void {
    if (this.shapefileLayer) {
      this.map.removeLayer(this.shapefileLayer);
      this.shapefileLayer = undefined!;
      this.setStatus('Layer cleared. Ready for new upload.');
      this.map.getView().setCenter([-10968310.601, 4512834.218]);
      this.map.getView().setZoom(6);
    }
  }
}
