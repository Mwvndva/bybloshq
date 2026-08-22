Accept Payments
In a nutshell
To accept a payment, create a transaction using our API, our client Javascript library, Popup JS, or our SDKs. Every transaction includes a link that can be used to complete payment.

Popup
Paystack Popup is a Javascript library that allow developers to build a secure and convenient payment flow for their web applications. You can add it to your frontend application via CDN, NPM or Yarn:

CDNNPMYarn
npm i @paystack/inline-js

If you used NPM or Yarn, ensure you import the library as shown below:

import PaystackPop from '@paystack/inline-js'
With the library successfully installed, you can now begin the three-step integration process:

Initialize transaction
Complete transaction
Verify transaction status
Initialize transaction
To get started, you need to initialize the transaction from your backend. Initializing the transaction from the backend ensures you have full control of the transaction details. To do this, make a POST request from your backend to the Initialize TransactionAPI endpoint:


Node
Show Response

const https = require('https')

const params = JSON.stringify({
  "email": "customer@email.com",
  "amount": "500000"
})

const options = {
  hostname: 'api.paystack.co',
  port: 443,
  path: '/transaction/initialize',
  method: 'POST',
  headers: {
    Authorization: 'Bearer SECRET_KEY',
    'Content-Type': 'application/json'
  }
}

const req = https.request(options, res => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  });

  res.on('end', () => {
    console.log(JSON.parse(data))
  })
}).on('error', error => {
  console.error(error)
})

req.write(params)
req.end()
The data object of the response contains an access_code parameter that is needed to complete the transaction. You should store this parameter and send it to your frontend.

Do not use your secret key in your frontend
Never call the Paystack API directly from your frontend to avoid exposing your secret key on the frontend. All requests to the Paystack API should be initiated from your server, and your frontend gets the response from your server.

Complete transaction
Your frontend application should make a request to your backend to initialize the transaction and get the access_code as described in the previous section. On getting the access_code from your backend, you can then use Popup to complete the transaction:

const popup = new PaystackPop()
popup.resumeTransaction(access_code)
The resumeTransaction method triggers the checkout in the browser, allowing the user to choose their preferred payment channel to complete the transaction. You can check out the InlineJS reference guide to learn about the features available in Popup V2.

Verify transaction status
Finally, you need to confirm the status of the transaction by using either webhooks or the verify transactions endpoint. Regardless of the method used, you need to use the following parameter to confirm if you should deliver value to your customer or not:

Parameter	Description
data.status	This inidicates if the payment is successful or not
data.amount	This indicates the price of your product or service in the lower denomination of your currency.
Verify amount
When verifying the status of a transaction, you should also verify the amount to ensure it matches the value of the service you are delivering. If the amount doesn't match, do not deliver value to the customer.

Redirect
Here, you call the Initialize TransactionAPI from your server to generate a checkout link, then redirect your users to the link so they can pay. After payment is made, the users are returned to your website at the callback_url

Warning
Confirm that your server can conclude a TLSv1.2 connection to Paystack's servers. Most up-to-date software have this capability. Contact your service provider for guidance if you have any SSL errors.

Collect customer information
To initialize the transaction, you'll need to pass information such as email, first name, last name amount, transaction reference, etc. Email and amount are required. You can also pass any other additional information in the metadata object field.

The customer information can be retrieved from your database, session or cookie if you already have it stored, or from a form like in the example below.

HTML
<form action="/save-order-and-pay" method="POST"> 
  <input type="hidden" name="user_email" value="<?php echo $email; ?>"> 
  <input type="hidden" name="amount" value="<?php echo $amount; ?>"> 
  <input type="hidden" name="cartid" value="<?php echo $cartid; ?>"> 
  <button type="submit" name="pay_now" id="pay-now" title="Pay now">Pay now</button>
</form>
Initialize transaction
When a customer clicks the payment action button, initialize a transaction by making a POST request to our API. Pass the email, amount and any other parameters to the Initialize TransactionAPI endpoint.

If the API call is successful, we will return an authorization URL which you will redirect to for the customer to input their payment information to complete the transaction.

Important notes

The amount should be in the subunit of the supported currency.
We used the cart_id from the form above as our transaction reference. You should use a unique transaction identifier from your system as your reference.
We set the callback_url in the transaction_data array. If you don't do this, we'll use the one that is set on your dashboard. Setting it in the code allows you to be flexible with the redirect URL if you need to
If you don't set a callback URL on the dashboard or on the code, the users will not be redirected back to your site after payment.
You can set test callback URLs for test transactions and live callback URLs for live transactions.
PHP
<?php
  $url = "https://api.paystack.co/transaction/initialize";

  $fields = [
    'email' => "customer@email.com",
    'amount' => "20000",
    'callback_url' => "https://hello.pstk.xyz/callback",
    'metadata' => ["cancel_action" => "https://your-cancel-url.com"]
  ];

  $fields_string = http_build_query($fields);

  //open connection
  $ch = curl_init();
  
  //set the url, number of POST vars, POST data
  curl_setopt($ch,CURLOPT_URL, $url);
  curl_setopt($ch,CURLOPT_POST, true);
  curl_setopt($ch,CURLOPT_POSTFIELDS, $fields_string);
  curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    "Authorization: Bearer SECRET_KEY",
    "Cache-Control: no-cache",
  ));
  
  //So that curl_exec returns the contents of the cURL; rather than echoing it
  curl_setopt($ch,CURLOPT_RETURNTRANSFER, true); 
  
  //execute post
  $result = curl_exec($ch);
  echo $result;
?>
Verify Transaction
If the transaction is successful, Paystack will redirect the user back to a callback_url you set. We'll append the transaction reference in the URL. In the example above, the user will be redirected to http://your_website.com/postpayment_callback.php?reference=YOUR_REFERENCE.

So you retrieve the reference from the URL parameter and use that to call the verify endpoint to confirm the status of the transaction. Learn more about verifying transactions.

It's very important that you call the Verify endpoint to confirm the status of the transactions before delivering value. Just because the callback_url was visited doesn't prove that transaction was successful.

Handle Webhook
When a payment is successful, Paystack sends a charge.success webhook event to webhook URL that you provide. Learn more about using webhooks.