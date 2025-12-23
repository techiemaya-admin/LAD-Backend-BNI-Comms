import os
import json
from typing import Dict, List, Any, Optional
from enum import Enum

class Environment(Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"

class FeatureFlags:
    """
    Feature flag management system for LAD SaaS platform
    """
    
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or os.path.join(
            os.path.dirname(__file__), '..', '..', 'configs', 'feature-flags', 'flags.json'
        )
        self.flags = self._load_flags()
        self.environment = self._get_environment()
    
    def _get_environment(self) -> Environment:
        """Get current environment from environment variable"""
        env = os.getenv('NODE_ENV', 'development').lower()
        if env == 'production':
            return Environment.PRODUCTION
        elif env == 'staging':
            return Environment.STAGING
        else:
            return Environment.DEVELOPMENT
    
    def _load_flags(self) -> Dict[str, Any]:
        """Load feature flags from JSON configuration file"""
        try:
            with open(self.config_path, 'r') as f:
                config = json.load(f)
                return config.get('features', {})
        except FileNotFoundError:
            print(f"Warning: Feature flags config not found at {self.config_path}")
            return {}
        except json.JSONDecodeError as e:
            print(f"Error parsing feature flags config: {e}")
            return {}
    
    def is_feature_enabled(self, feature_name: str, user_group: str = None, user_id: str = None) -> bool:
        """
        Check if a feature is enabled for the current environment and user
        
        Args:
            feature_name: Name of the feature to check
            user_group: User's group (admin, sales, premium, basic, etc.)
            user_id: User ID for percentage rollout calculation
        
        Returns:
            True if feature is enabled, False otherwise
        """
        if feature_name not in self.flags:
            return False
        
        feature = self.flags[feature_name]
        
        # Check if feature is globally enabled
        if not feature.get('enabled', False):
            return False
        
        # Check environment
        environments = feature.get('environments', {})
        if not environments.get(self.environment.value, False):
            return False
        
        # Check user group access
        if user_group:
            allowed_groups = feature.get('user_groups', [])
            if allowed_groups and user_group not in allowed_groups:
                return False
        
        # Check rollout percentage
        rollout_percentage = feature.get('rollout_percentage', 100)
        if rollout_percentage < 100 and user_id:
            # Simple hash-based rollout - consistent for same user
            user_hash = abs(hash(user_id)) % 100
            if user_hash >= rollout_percentage:
                return False
        
        return True
    
    def get_enabled_features(self, user_group: str = None, user_id: str = None) -> List[str]:
        """Get list of all enabled features for a user"""
        enabled = []
        for feature_name in self.flags:
            if self.is_feature_enabled(feature_name, user_group, user_id):
                enabled.append(feature_name)
        return enabled
    
    def get_feature_config(self, feature_name: str) -> Optional[Dict[str, Any]]:
        """Get full configuration for a specific feature"""
        return self.flags.get(feature_name)
    
    def reload_flags(self):
        """Reload feature flags from configuration file"""
        self.flags = self._load_flags()

# Global instance
feature_flags = FeatureFlags()

# Convenience functions
def is_enabled(feature_name: str, user_group: str = None, user_id: str = None) -> bool:
    """Check if feature is enabled"""
    return feature_flags.is_feature_enabled(feature_name, user_group, user_id)

def get_enabled_features(user_group: str = None, user_id: str = None) -> List[str]:
    """Get enabled features for user"""
    return feature_flags.get_enabled_features(user_group, user_id)

# Feature decorators
def require_feature(feature_name: str):
    """Decorator to require a feature flag for function execution"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            # In a web context, you'd get user info from request
            if not is_enabled(feature_name):
                raise Exception(f"Feature '{feature_name}' is not enabled")
            return func(*args, **kwargs)
        return wrapper
    return decorator

# Example usage:
if __name__ == "__main__":
    # Test feature flags
    print("Environment:", feature_flags.environment.value)
    print("Apollo Leads enabled:", is_enabled("apollo_leads", "admin"))
    print("Voice Agent enabled:", is_enabled("voice_agent", "sales"))
    print("LinkedIn Integration enabled:", is_enabled("linkedin_integration", "basic"))
    print("\nEnabled features for admin user:")
    for feature in get_enabled_features("admin", "user123"):
        print(f"  - {feature}")