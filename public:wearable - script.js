// Wearable Sync Frontend JavaScript
class WearableSync {
    constructor() {
        this.socket = io();
        this.connectedDevice = null;
        this.isSyncing = false;
        this.dataPoints = [];
        this.currentStats = {
            totalSteps: 0,
            totalCalories: 0,
            heartRateReadings: [],
            activeMinutes: 0
        };

        this.initializeEventListeners();
        this.loadSupportedDevices();
    }

    initializeEventListeners() {
        // Device selection
        document.querySelectorAll('.device-option').forEach(option => {
            option.addEventListener('click', (e) => {
                document.querySelectorAll('.device-option').forEach(opt => {
                    opt.classList.remove('border-green-500', 'bg-green-50');
                });
                e.currentTarget.classList.add('border-green-500', 'bg-green-50');
                this.selectedDevice = e.currentTarget.dataset.device;
            });
        });

        // Connection buttons
        document.getElementById('connectBtn').addEventListener('click', () => this.connectDevice());
        document.getElementById('syncBtn').addEventListener('click', () => this.startSync());
        document.getElementById('stopSyncBtn').addEventListener('click', () => this.stopSync());
        document.getElementById('disconnectBtn').addEventListener('click', () => this.disconnectDevice());
        document.getElementById('exportDataBtn').addEventListener('click', () => this.exportData());
        document.getElementById('viewReportBtn').addEventListener('click', () => this.generateHealthReport());

        // Socket events
        this.socket.on('wearableData', (data) => this.handleWearableData(data));
        this.socket.on('connect', () => this.updateConnectionStatus(true));
        this.socket.on('disconnect', () => this.updateConnectionStatus(false));
    }

    async loadSupportedDevices() {
        try {
            const response = await fetch('/api/wearable/supported-devices');
            const data = await response.json();
            console.log('Supported devices:', data);
        } catch (error) {
            console.error('Error loading supported devices:', error);
        }
    }

    async connectDevice() {
        if (!this.selectedDevice) {
            this.showToast('Please select a device first', 'error');
            return;
        }

        try {
            const response = await fetch('/api/wearable/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    deviceType: this.selectedDevice,
                    deviceName: this.getDeviceName(this.selectedDevice),
                    userId: 'user-' + Date.now()
                })
            });

            const result = await response.json();

            if (response.ok) {
                this.connectedDevice = result.device;
                this.updateConnectionUI(true);
                this.showToast('Device connected successfully!');
            } else {
                this.showToast(result.error, 'error');
            }
        } catch (error) {
            console.error('Error connecting device:', error);
            this.showToast('Failed to connect device', 'error');
        }
    }

    disconnectDevice() {
        if (!this.connectedDevice) return;

        fetch(`/api/wearable/disconnect/${this.connectedDevice.id}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(result => {
            this.connectedDevice = null;
            this.isSyncing = false;
            this.updateConnectionUI(false);
            this.showToast('Device disconnected');
        })
        .catch(error => {
            console.error('Error disconnecting device:', error);
            this.showToast('Error disconnecting device', 'error');
        });
    }

    startSync() {
        if (!this.connectedDevice) return;

        this.socket.emit('startWearableSync', {
            deviceType: this.connectedDevice.deviceType,
            deviceId: this.connectedDevice.id
        });

        this.isSyncing = true;
        this.updateSyncUI(true);
        this.showToast('Real-time sync started');
    }

    stopSync() {
        this.socket.emit('stopWearableSync');
        this.isSyncing = false;
        this.updateSyncUI(false);
        this.showToast('Sync stopped');
    }

    handleWearableData(data) {
        // Add to data points
        this.dataPoints.push(data);
        
        // Update current stats
        this.updateStatistics(data);
        
        // Update real-time displays
        this.updateRealTimeDisplays(data);
        
        // Add to data stream log
        this.addToDataStream(data);
        
        // Check for health insights
        this.checkHealthInsights(data);
        
        // Update connection status
        this.updateLastSync();
    }

    updateStatistics(data) {
        // Steps
        if (data.steps) {
            this.currentStats.totalSteps += data.steps;
            document.getElementById('totalSteps').textContent = this.currentStats.totalSteps.toLocaleString();
        }

        // Calories
        if (data.calories) {
            this.currentStats.totalCalories += data.calories;
            document.getElementById('totalCalories').textContent = this.currentStats.totalCalories.toLocaleString();
        }

        // Heart rate
        if (data.heartRate) {
            this.currentStats.heartRateReadings.push(data.heartRate);
            const avg = this.currentStats.heartRateReadings.reduce((a, b) => a + b, 0) / this.currentStats.heartRateReadings.length;
            document.getElementById('avgHeartRate').textContent = Math.round(avg);
        }

        // Active minutes (simplified)
        if (data.steps && data.steps > 100) {
            this.currentStats.activeMinutes += 1;
            document.getElementById('activeMinutes').textContent = this.currentStats.activeMinutes;
        }
    }

    updateRealTimeDisplays(data) {
        // Heart Rate
        if (data.heartRate) {
            document.getElementById('heartRateValue').textContent = data.heartRate;
            const status = data.heartRate > 100 ? 'Elevated' : data.heartRate < 60 ? 'Low' : 'Normal';
            document.getElementById('heartRateStatus').textContent = status;
            document.getElementById('heartRateStatus').className = `mt-2 text-xs ${
                data.heartRate > 100 ? 'text-red-500' : data.heartRate < 60 ? 'text-yellow-500' : 'text-green-500'
            }`;
        }

        // Blood Oxygen
        if (data.bloodOxygen) {
            document.getElementById('bloodOxygenValue').textContent = data.bloodOxygen;
            const status = data.bloodOxygen < 95 ? 'Low' : 'Normal';
            document.getElementById('bloodOxygenStatus').textContent = status;
            document.getElementById('bloodOxygenStatus').className = `mt-2 text-xs ${
                data.bloodOxygen < 95 ? 'text-red-500' : 'text-green-500'
            }`;
        }

        // Steps
        if (data.steps) {
            document.getElementById('stepsValue').textContent = data.steps;
            document.getElementById('stepsStatus').textContent = 'Active';
            document.getElementById('stepsStatus').className = 'mt-2 text-xs text-green-500';
        }
    }

    addToDataStream(data) {
        const stream = document.getElementById('dataStream');
        const entry = document.createElement('div');
        entry.className = 'data-stream pl-3 py-1';
        
        const time = new Date(data.timestamp).toLocaleTimeString();
        let content = `[${time}] `;
        
        if (data.heartRate) content += `HR: ${data.heartRate}bpm `;
        if (data.steps) content += `Steps: ${data.steps} `;
        if (data.bloodOxygen) content += `SpO₂: ${data.bloodOxygen}% `;
        if (data.calories) content += `Cal: ${data.calories} `;
        
        entry.textContent = content;
        stream.prepend(entry);
        
        // Keep only last 20 entries
        const entries = stream.querySelectorAll('.data-stream');
        if (entries.length > 20) {
            entries[entries.length - 1].remove();
        }
    }

    checkHealthInsights(data) {
        const insights = [];
        
        // Heart rate insights
        if (data.heartRate > 100) {
            insights.push({
                type: 'warning',
                message: 'Elevated heart rate detected',
                recommendation: 'Consider resting and deep breathing'
            });
        }
        
        if (data.bloodOxygen && data.bloodOxygen < 95) {
            insights.push({
                type: 'warning',
                message: 'Low blood oxygen level',
                recommendation: 'Monitor and consult if persistent'
            });
        }
        
        // Update insights display
        this.updateInsightsDisplay(insights);
    }

    updateInsightsDisplay(insights) {
        const container = document.getElementById('insightsContainer');
        
        if (insights.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-4">
                    <p>All metrics within normal range</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        insights.forEach(insight => {
            const bgColor = insight.type === 'warning' ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200';
            const textColor = insight.type === 'warning' ? 'text-yellow-700' : 'text-blue-700';
            
            html += `
                <div class="${bgColor} border rounded-lg p-3">
                    <div class="font-medium ${textColor}">${insight.message}</div>
                    <div class="text-sm ${textColor} opacity-75 mt-1">${insight.recommendation}</div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    updateConnectionUI(connected) {
        const statusDiv = document.getElementById('connectionStatus');
        const connectBtn = document.getElementById('connectBtn');
        const syncBtn = document.getElementById('syncBtn');
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        const connectedDevice = document.getElementById('connectedDevice');
        const disconnectBtn = document.getElementById('disconnectBtn');

        if (connected) {
            statusDiv.classList.remove('hidden');
            connectBtn.classList.add('hidden');
            syncBtn.classList.remove('hidden');
            disconnectBtn.classList.remove('hidden');
            statusIndicator.className = 'w-3 h-3 bg-green-500 rounded-full mr-2 pulse-ring';
            statusText.textContent = 'Connected';
            connectedDevice.textContent = this.getDeviceName(this.connectedDevice.deviceType);
            this.updateLastSync();
        } else {
            statusDiv.classList.add('hidden');
            connectBtn.classList.remove('hidden');
            syncBtn.classList.add('hidden');
            disconnectBtn.classList.add('hidden');
            this.updateSyncUI(false);
        }
    }

    updateSyncUI(syncing) {
        const syncBtn = document.getElementById('syncBtn');
        const stopSyncBtn = document.getElementById('stopSyncBtn');
        const streamStatus = document.getElementById('streamStatus');

        if (syncing) {
            syncBtn.classList.add('hidden');
            stopSyncBtn.classList.remove('hidden');
            streamStatus.innerHTML = `
                <div class="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span class="text-sm text-green-600">Streaming live data</span>
            `;
        } else {
            syncBtn.classList.remove('hidden');
            stopSyncBtn.classList.add('hidden');
            streamStatus.innerHTML = `
                <div class="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                <span class="text-sm text-gray-600">Not streaming</span>
            `;
        }
    }

    updateConnectionStatus(connected) {
        const statusIndicator = document.getElementById('statusIndicator');
        if (statusIndicator) {
            statusIndicator.className = connected ? 
                'w-3 h-3 bg-green-500 rounded-full mr-2 pulse-ring' : 
                'w-3 h-3 bg-red-500 rounded-full mr-2';
        }
    }

    updateLastSync() {
        const lastSync = document.getElementById('lastSync');
        const dataPoints = document.getElementById('dataPoints');
        
        if (lastSync) {
            lastSync.textContent = new Date().toLocaleTimeString();
        }
        if (dataPoints) {
            dataPoints.textContent = this.dataPoints.length;
        }
    }

    getDeviceName(deviceType) {
        const names = {
            'apple-watch': 'Apple Watch',
            'fitbit': 'Fitbit',
            'samsung-health': 'Samsung Health',
            'generic': 'Generic Fitness Tracker'
        };
        return names[deviceType] || deviceType;
    }

    async exportData() {
        if (this.dataPoints.length === 0) {
            this.showToast('No data to export', 'error');
            return;
        }

        const dataStr = JSON.stringify(this.dataPoints, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `nutripal-health-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.showToast('Data exported successfully');
    }

    async generateHealthReport() {
        if (this.dataPoints.length === 0) {
            this.showToast('No data available for report', 'error');
            return;
        }

        // Calculate health metrics from wearable data
        const avgHeartRate = this.currentStats.heartRateReadings.length > 0 ?
            this.currentStats.heartRateReadings.reduce((a, b) => a + b, 0) / this.currentStats.heartRateReadings.length : 0;

        // Redirect to health report page with wearable data
        window.location.href = `/?wearableData=${encodeURIComponent(JSON.stringify({
            avgHeartRate: Math.round(avgHeartRate),
            totalSteps: this.currentStats.totalSteps,
            totalCalories: this.currentStats.totalCalories,
            activeMinutes: this.currentStats.activeMinutes
        }))}`;
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        
        const bgColor = type === 'error' ? 'bg-red-600' : 'bg-green-600';
        toast.className = `fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg transform translate-y-16 transition-transform duration-300 flex items-center`;
        toastMessage.textContent = message;
        
        toast.classList.remove('hidden', 'translate-y-16');
        toast.classList.add('translate-y-0');
        
        setTimeout(() => {
            toast.classList.remove('translate-y-0');
            toast.classList.add('translate-y-16');
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 300);
        }, 3000);
    }
}

// Initialize the wearable sync when page loads
document.addEventListener('DOMContentLoaded', () => {
    new WearableSync();
});