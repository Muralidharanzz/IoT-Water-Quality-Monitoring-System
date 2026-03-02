# IoT-Based Community Water Quality Monitoring System

A full-stack, serverless web application integrated with ESP32 hardware and Firebase to monitor and broadcast community water quality metrics in real-time.

## Features

*   **Real-time Sensor Monitoring**: Live pH, TDS, Turbidity, and Temperature metrics updated seamlessly via Firebase Realtime Database.
*   **Role-Based Access Control**: Separate workflows and views for 'Admin' (Community Head) and 'User' (Community People).
*   **Automatic Threshold Alerts**: Smart alerts visually indicate when parameter levels exceed predefined safe bounds.
*   **Data Export**: Admins can export historical sensor data via CSV and generate summarized PDF Reports.
*   **Responsive UI**: Modern interface built with Bootstrap and custom Glassmorphism CSS styling.

## Directory Structure

*   **/website**: Contains all front-end code (HTML, CSS, JS) meant to be deployed to Firebase Hosting.
*   **/hardware**: Contains the `.ino` template file for flashing the ESP32 microcontroller to interface with the sensors.
*   **/documentation**: Contains architectural designs and supplementary information.

## Setup Instructions

### 1. Web Application Deployment
1. Install [Node.js](https://nodejs.org/) and run `npm install -g firebase-tools`.
2. Navigate to the project directory and run `firebase login`.
3. Initialize hosting via `firebase init hosting` and set the public directory to `website`.
4. Run `firebase deploy` to publish the site globally.

### 2. Hardware Setup
1. Open `hardware/main.ino` in the Arduino IDE.
2. Provide your local WiFi credentials (`ssid`, `password`).
3. Flash to your ESP32 board. The board will begin POSTing data to the specified Firebase Realtime Database URL.

## Business Logic (Safe Parameters)
*   **pH**: 6.5 - 8.5
*   **TDS**: < 300 ppm
*   **Turbidity**: < 5 NTU
*   **Temperature**: < 35°C

*This project relies entirely on the Firebase Spark (Free) plan.*