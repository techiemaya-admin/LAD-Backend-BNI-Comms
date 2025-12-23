/**
 * Core SaaS Platform Application
 * 
 * PURPOSE:
 * This is the main application entry point for a production-grade SaaS platform.
 * It implements a feature-based architecture where:
 * 
 * 1. CORE PLATFORM: Always-available services (auth, billing, users)
 * 2. OPTIONAL FEATURES: Client-specific features loaded dynamically based on their subscription plan
 * 3. FEATURE FLAGS: Database-backed system for controlling feature access per client
 * 4. DYNAMIC LOADING: Features are registered and loaded only when clients have access
 * 
 * ARCHITECTURE BENEFITS:
 * - Multi-tenant: Each client gets features based on their plan
 * - Scalable: Add new features without touching core platform
 * - Secure: Feature access is enforced at middleware level
 * - Billing-ready: Credit tracking and usage monitoring built-in
 * - Zero-downtime: Features can be enabled/disabled without restarts
 * 
 * USAGE:
 * const CoreApplication = require('./core/app');
 * const app = new CoreApplication();
 * await app.start(3000);
 * 
 * ENDPOINTS:
 * /api/auth/*     - Authentication (always available)
 * /api/billing/*  - Billing & plans (always available) 
 * /api/users/*    - User management (always available)
 * /api/features   - Get client's enabled features
 * /api/{feature}/* - Dynamic feature routes (access controlled)
 */

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { FeatureRegistry } = require('./feature_registry');
const { FeatureFlagService } = require('../feature_flags/service');
const authRoutes = require('./auth/routes');
const billingRoutes = require('./billing/routes');
const userRoutes = require('./users/routes');
const { authenticateToken } = require('./middleware/auth');
const { trackClientFeatures } = require('./middleware/feature_tracking');

class CoreApplication {
  constructor() {
    this.app = express();
    this.featureRegistry = new FeatureRegistry();
    this.featureFlagService = new FeatureFlagService();
    this.setupMiddleware();
    this.setupCoreRoutes();
  }

  setupMiddleware() {
    // Allow multiple origins for CORS
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3002',
      'https://lad-frontend-3nddlneyya-uc.a.run.app',
      'https://lad-frontend-741719885039.us-central1.run.app',
      'https://lad-frontend-develop-741719885039.us-central1.run.app',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          console.log(`[CORS] Blocked origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true, // Allow cookies to be sent
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      preflightContinue: false, // Let cors handle preflight
      optionsSuccessStatus: 204 // Success status for preflight
    }));
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser()); // Parse cookies
    
    // Core middleware (always enabled)
    this.app.use(authenticateToken);
    this.app.use(trackClientFeatures);
  }

  setupCoreRoutes() {
    // Health check endpoint for Docker/Cloud Run
    this.app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // Platform routes (always available)
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/billing', billingRoutes);
    this.app.use('/api/users', userRoutes);
    
    // Campaigns routes (always available for existing customers)
    try {
      const campaignsRoutes = require('../features/campaigns/campaigns');
      this.app.use('/api/campaigns', campaignsRoutes);
      console.log('✅ Campaigns routes mounted (always available)');
    } catch (error) {
      console.warn('⚠️  Failed to mount campaigns routes:', error.message);
    }
    
    // Feature flags endpoint
    this.app.get('/api/features', async (req, res) => {
      try {
        const organizationId = req.user?.organizationId || req.headers['x-organization-id'];
        const userId = req.user?.userId;
        const features = await this.featureFlagService.getClientFeatures(organizationId, userId);
        res.json({ success: true, features });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
  }

  async registerFeatures() {
    // Register all available features
    await this.featureRegistry.discoverFeatures();
    
    // Setup dynamic feature loading
    this.app.use('/api/:feature', async (req, res, next) => {
      try {
        const featureKey = req.params.feature;
        const organizationId = req.user?.tenantId || req.user?.organizationId || req.headers['x-organization-id'];
        const userId = req.user?.userId;
        
        console.log(`[Core App] Feature: ${featureKey}, OrgID: ${organizationId}, UserID: ${userId}`);
        
        const isEnabled = await this.featureFlagService.isEnabled(organizationId, featureKey, userId);
        console.log(`[Core App] Feature ${featureKey} enabled: ${isEnabled}`);
        
        if (!isEnabled) {
          return res.status(403).json({
            success: false,
            error: 'Feature not available',
            feature: featureKey
          });
        }
        
        // Load and mount feature router dynamically
        const featureRouter = await this.featureRegistry.loadFeatureRouter(featureKey, organizationId);
        if (featureRouter) {
          featureRouter(req, res, next);
        } else {
          next();
        }
      } catch (error) {
        console.error('Error loading feature:', error);
        next();
      }
    });
  }

  async start(port = 3000) {
    await this.registerFeatures();
    
    this.app.listen(port, () => {
      console.log(`🚀 Core Platform running on port ${port}`);
      console.log('📦 Registered features:', this.featureRegistry.getFeatureList());
    });
  }
}

module.exports = CoreApplication;