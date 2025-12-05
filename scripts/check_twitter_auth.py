
import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from admin.config import config
    
    print("Checking Twitter Credentials...")
    print(f"TWITTER_CONSUMER_KEY: {'[PRESENT]' if config.TWITTER_CONSUMER_KEY else '[MISSING]'}")
    print(f"TWITTER_CONSUMER_SECRET: {'[PRESENT]' if config.TWITTER_CONSUMER_SECRET else '[MISSING]'}")
    print(f"TWITTER_ACCESS_TOKEN: {'[PRESENT]' if config.TWITTER_ACCESS_TOKEN else '[MISSING]'}")
    print(f"TWITTER_ACCESS_TOKEN_SECRET: {'[PRESENT]' if config.TWITTER_ACCESS_TOKEN_SECRET else '[MISSING]'}")
    print(f"TWITTER_BEARER_TOKEN: {'[PRESENT]' if config.TWITTER_BEARER_TOKEN else '[MISSING]'}")

    if config.TWITTER_CONSUMER_KEY and config.TWITTER_CONSUMER_SECRET and config.TWITTER_ACCESS_TOKEN and config.TWITTER_ACCESS_TOKEN_SECRET:
        print("\nCredential check passed. Attempting to authenticate with Tweepy...")
        try:
            import tweepy
            client = tweepy.Client(
                consumer_key=config.TWITTER_CONSUMER_KEY,
                consumer_secret=config.TWITTER_CONSUMER_SECRET,
                access_token=config.TWITTER_ACCESS_TOKEN,
                access_token_secret=config.TWITTER_ACCESS_TOKEN_SECRET
            )
            # Try to get me
            user = client.get_me()
            if user and user.data:
                print(f"Successfully authenticated as: {user.data.username}")
            else:
                print("Authentication successful, but could not retrieve user data.")
        except ImportError:
            print("Tweepy is not installed.")
        except Exception as e:
            print(f"Authentication failed: {e}")
    else:
        print("\nSome credentials are missing.")

except ImportError as e:
    print(f"Error importing config: {e}")
