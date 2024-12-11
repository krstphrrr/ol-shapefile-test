import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import { ShapefileUploadComponent } from "./shapefile-upload/shapefile-upload.component";


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ShapefileUploadComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {

  map!: Map;

  ngOnInit() {
    this.map = new Map({
      target: 'map',
      layers: [
        new TileLayer({
          source: new XYZ({
            url: 'https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}', 
          }),
        }),
      ],
      view: new View({
        center: [-10968310.601, 4512834.218], 
        zoom:6,
        projection: 'EPSG:3857'

      }),
    });

  }
}
