import pandas as pd
from bs4 import BeautifulSoup
import requests
import time

# Mobiles 4 pages
# Audio 3 pages
# Stationery 3 page
# Kitchen 2 page
# Smartwatches 3 pages


products = pd.DataFrame(columns=['Title', 'Price', 'About', 'Category', 'Image_Link'])
HEADERS = ({'User-Agent':
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 '
                'Safari/537.36',
            'Accept-Language': 'en-US'})

url = input("Enter category link to parse: ")
Category = input("Enter category name: ")

cat_webpage = requests.get(url, headers=HEADERS)
soup = BeautifulSoup(cat_webpage.content, "lxml")
links = soup.find_all("a", attrs={'class': 'a-link-normal s-no-outline'})
print("Processing...")
for link in links:
    URL = "https://www.amazon.in" + link['href']
    webpage = requests.get(URL, headers=HEADERS)
    soup = BeautifulSoup(webpage.content, "lxml")

    title = soup.find("span", attrs={"id": 'productTitle'})
    if title:
        title = title.getText().strip()
    else:
        continue

    price = soup.find("span", attrs={"class": 'a-price-whole'})
    if price:
        price = price.getText().replace(',', '').replace('.', '').strip()
    else:
        continue

    about_this_item = soup.find("div", attrs={"id": "feature-bullets"})
    if about_this_item:
        about_this_item = [[about.strip()] for about in about_this_item.getText().split("   ")]
        about_this_item = about_this_item[1:len(about_this_item) - 1]
        print(about_this_item)
    else:
        continue

    product_img = soup.find("img", attrs={"id": "landingImage"})['src']

    products = products.append(
        {"Title": title, "Price": price, "About": about_this_item, 'Category': Category, 'Image_Link': product_img},
        ignore_index=True)

# products.to_csv('Products.csv', mode='a', index=False, header=False)
print("Done :)")
