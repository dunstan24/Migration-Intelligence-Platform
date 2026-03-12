import pandas as pd
import glob
import os

# Set target directory
base_dir = r"C:\Users\User\Documents\Interlace\Migration_platform\EOI_data"
pattern = os.path.join(base_dir, "**", "MASTER_DATA_EOI*.csv")

# Find all matching files recursively
csv_files = glob.glob(pattern, recursive=True)

print(f"Found {len(csv_files)} files. Merging...")

df_list = []
for file in csv_files:
    try:
        df = pd.read_csv(file)
        df_list.append(df)
        print(f"Read {file} successfully.")
    except Exception as e:
        print(f"Error reading {file}: {e}")

if df_list:
    # Combine everything
    combined_df = pd.concat(df_list, ignore_index=True)
    
    # Sort by the timeframe column if it exists ('As At Month')
    if 'As At Month' in combined_df.columns:
        # Convert to datetime to sort correctly (format MM/YYYY)
        combined_df['Sort Date'] = pd.to_datetime(combined_df['As At Month'], format='%m/%Y', errors='coerce')
        combined_df = combined_df.sort_values('Sort Date')
        combined_df = combined_df.drop(columns=['Sort Date'])
        
    output_path = os.path.join(base_dir, "MASTER_DATA_EOI_COMBINED.csv")
    combined_df.to_csv(output_path, index=False)
    print(f"Successfully saved combined dataset with {len(combined_df)} rows to {output_path}")
else:
    print("No data frames to merge.")
