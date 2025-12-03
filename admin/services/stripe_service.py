"""
Stripe integration for premium essay payments.
Handles one-time payments and subscriptions.
"""

import os
import stripe
from dotenv import load_dotenv
from typing import Optional, Dict

load_dotenv()

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY")

# Premium essay pricing (in cents)
ESSAY_PRICES = {
    "workshop": 1000,      # $10
    "consulting": 2500,    # $25
    "full-class": 5000     # $50
}

SUBSCRIPTION_PRICE = 9900  # $99/month


class StripeService:
    """Service for handling Stripe payments"""
    
    @staticmethod
    def create_essay_checkout(
        essay_slug: str,
        essay_tier: str,
        essay_title: str,
        success_url: str,
        cancel_url: str,
        customer_email: Optional[str] = None
    ) -> Dict:
        """
        Creates a Stripe Checkout session for a single essay purchase.
        
        Args:
            essay_slug: Unique identifier for the essay
            essay_tier: 'workshop', 'consulting', or 'full-class'
            essay_title: Human-readable title
            success_url: Where to redirect after successful payment
            cancel_url: Where to redirect if payment cancelled
            customer_email: Optional pre-fill email
            
        Returns:
            Dict with checkout session details including URL
        """
        if essay_tier not in ESSAY_PRICES:
            raise ValueError(f"Invalid essay tier: {essay_tier}")
        
        price = ESSAY_PRICES[essay_tier]
        
        try:
            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': f'{essay_title} ({essay_tier.replace("-", " ").title()} Essay)',
                            'description': f'Premium {essay_tier} essay access',
                            'metadata': {
                                'essay_slug': essay_slug,
                                'essay_tier': essay_tier
                            }
                        },
                        'unit_amount': price,
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=success_url + f'?session_id={{CHECKOUT_SESSION_ID}}&essay={essay_slug}',
                cancel_url=cancel_url,
                customer_email=customer_email,
                metadata={
                    'essay_slug': essay_slug,
                    'essay_tier': essay_tier,
                    'product_type': 'premium_essay'
                }
            )
            
            return {
                'session_id': session.id,
                'url': session.url,
                'amount': price
            }
            
        except Exception as e:
            raise Exception(f"Stripe checkout creation failed: {str(e)}")
    
    @staticmethod
    def create_subscription_checkout(
        success_url: str,
        cancel_url: str,
        customer_email: Optional[str] = None
    ) -> Dict:
        """
        Creates a Stripe Checkout session for monthly subscription.
        
        Returns:
            Dict with checkout session details including URL
        """
        try:
            # First, create or get the subscription price
            prices = stripe.Price.list(
                lookup_keys=['premium_essays_monthly'],
                limit=1
            )
            
            if prices.data:
                price_id = prices.data[0].id
            else:
                # Create price if it doesn't exist
                product = stripe.Product.create(
                    name='Premium Essays Unlimited',
                    description='Unlimited access to all premium essays',
                )
                
                price = stripe.Price.create(
                    product=product.id,
                    unit_amount=SUBSCRIPTION_PRICE,
                    currency='usd',
                    recurring={'interval': 'month'},
                    lookup_key='premium_essays_monthly'
                )
                price_id = price.id
            
            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price': price_id,
                    'quantity': 1,
                }],
                mode='subscription',
                success_url=success_url + '?session_id={CHECKOUT_SESSION_ID}',
                cancel_url=cancel_url,
                customer_email=customer_email,
                metadata={
                    'product_type': 'subscription'
                }
            )
            
            return {
                'session_id': session.id,
                'url': session.url,
                'amount': SUBSCRIPTION_PRICE
            }
            
        except Exception as e:
            raise Exception(f"Subscription checkout creation failed: {str(e)}")
    
    @staticmethod
    def verify_session(session_id: str) -> Dict:
        """
        Verifies a checkout session and returns payment details.
        
        Returns:
            Dict with payment_status, customer_email, and metadata
        """
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            
            return {
                'payment_status': session.payment_status,
                'customer_email': session.customer_email,
                'metadata': session.metadata,
                'amount_total': session.amount_total,
                'mode': session.mode  # 'payment' or 'subscription'
            }
            
        except Exception as e:
            raise Exception(f"Session verification failed: {str(e)}")
    
    @staticmethod
    def handle_webhook(payload: str, signature: str) -> Dict:
        """
        Handles Stripe webhook events.
        
        Args:
            payload: Raw webhook payload
            signature: Stripe signature header
            
        Returns:
            Dict with event type and data
        """
        webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
        
        try:
            event = stripe.Webhook.construct_event(
                payload, signature, webhook_secret
            )
            
            return {
                'type': event['type'],
                'data': event['data']['object']
            }
            
        except ValueError:
            raise Exception("Invalid payload")
        except stripe.error.SignatureVerificationError:
            raise Exception("Invalid signature")
    
    @staticmethod
    def check_subscription_status(customer_email: str) -> bool:
        """
        Checks if a customer has an active subscription.
        
        Returns:
            True if active subscription exists, False otherwise
        """
        try:
            customers = stripe.Customer.list(email=customer_email, limit=1)
            
            if not customers.data:
                return False
            
            customer = customers.data[0]
            subscriptions = stripe.Subscription.list(
                customer=customer.id,
                status='active',
                limit=1
            )
            
            return len(subscriptions.data) > 0
            
        except Exception as e:
            print(f"Subscription check error: {e}")
            return False
